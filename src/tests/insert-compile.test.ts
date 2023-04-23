import { Insertable, Kysely } from 'kysely';

import { TableMapper } from '../mappers/table-mapper';
import { createDB, resetDB, destroyDB } from './utils/test-setup';
import { Database, Users } from './utils/test-tables';
import { USERS } from './utils/test-objects';
import { ignore } from './utils/test-utils';
import { User } from './utils/test-types';
import {
  createUserMapperReturningAll,
  createUserMapperReturningNothing,
} from './utils/test-mappers';

let db: Kysely<Database>;

beforeAll(async () => {
  db = await createDB();
  userMapperReturningNothing = createUserMapperReturningNothing(db);
  userMapperReturningAll = createUserMapperReturningAll(db);
});
beforeEach(() => resetDB(db));
afterAll(() => destroyDB(db));

let userMapperReturningNothing: ReturnType<
  typeof createUserMapperReturningNothing
>;
let userMapperReturningAll: ReturnType<typeof createUserMapperReturningAll>;

describe('compiled insertions', () => {
  it('compiles a non-returning insert query without transformation', async () => {
    const compilation = userMapperReturningNothing
      .insert()
      .columns(['name', 'handle'])
      .compile();

    // test run()
    const success1 = await compilation.run(USERS[1]);
    expect(success1).toBe(true);

    // test returnOne()
    const success2 = await compilation.returnOne(USERS[2]);
    expect(success2).toBeUndefined();

    const readUsers = await userMapperReturningAll.select().returnAll();
    expect(readUsers.length).toEqual(2);
    expect(readUsers[0].handle).toEqual(USERS[1].handle);
    expect(readUsers[0].email).toEqual(null);
    expect(readUsers[1].handle).toEqual(USERS[2].handle);
    expect(readUsers[1].email).toEqual(null);
  });

  it('compiles a returning insert query without transformation', async () => {
    const compilation = userMapperReturningAll
      .insert()
      .columns(['name', 'handle', 'email'])
      .compile();

    // test returnOne()
    const insertReturn = await compilation.returnOne(USERS[0]);
    expect(insertReturn).toEqual({ ...USERS[0], id: 1 });
    // Ensure that the provided columns are accessible
    ((_: string) => {})(insertReturn!.name);

    // test run()
    const success1 = await compilation.run(USERS[1]);
    expect(success1).toBe(true);

    // test that non-specified columns are not inserted
    const success2 = await compilation.run({ ...USERS[2], id: 100 });
    expect(success2).toBe(true);

    const readUsers = await userMapperReturningAll.select().returnAll();
    expect(readUsers.length).toEqual(3);
    expect(readUsers[0].handle).toEqual(USERS[0].handle);
    expect(readUsers[1].handle).toEqual(USERS[1].handle);
    expect(readUsers[2].handle).toEqual(USERS[2].handle);
    expect(readUsers[2].id).toEqual(3);

    ignore('check compile-time types', () => {
      compilation.returnOne({
        name: 'xyz',
        handle: 'pdq',
        email: 'abc@def.hij',
        // @ts-expect-error - only insertable columns are allowed
        notThere: 32,
      });
      // @ts-expect-error - only expected columns are returned
      insertReturn!.notThere;
    });
  });

  it('compiles an insert query with transformation', async () => {
    expect.assertions(7);

    const columnSubset: (keyof Insertable<Users>)[] = [
      'name',
      'handle',
      'email',
    ];
    const transformMapper = new TableMapper(db, 'users', {
      insertReturnColumns: ['id'],
    }).withTransforms({
      selectTransform: (row) => {
        const names = row.name.split(' ');
        return new User(row.id, names[0], names[1], row.handle, row.email);
      },
      insertTransform: (source: User, columns) => {
        expect(columns).toEqual(columnSubset);
        return {
          name: `${source.firstName} ${source.lastName}`,
          handle: source.handle,
          email: source.email,
        };
      },
      insertReturnTransform: (source: User, returns) =>
        new User(
          returns.id,
          source.firstName,
          source.lastName,
          source.handle,
          source.email
        ),
      countTransform: (count) => Number(count),
    });
    const user1: Readonly<User> = new User(
      0,
      'John',
      'Doe',
      'johndoe',
      'jdoe@abc.def'
    );
    const user2: Readonly<User> = new User(
      0,
      'Sam',
      'Gamgee',
      'sg',
      'sg@abc.def'
    );
    const user3 = new User(100, 'Sue', 'Rex', 'srex', 'srex@abc.def');

    const compilation = transformMapper
      .insert()
      .columns(columnSubset)
      .compile();

    // test returnOne()
    const insertReturn = await compilation.returnOne(user1);
    expect(insertReturn).toEqual(User.create(1, user1));
    // Ensure that the provided columns are accessible
    ((_: string) => {})(insertReturn!.firstName);

    // test run()
    const success1 = await compilation.run(user2);
    expect(success1).toBe(true);

    // test that non-specified columns are not inserted
    const success2 = await compilation.run(user3);
    expect(success2).toBe(true);

    const readUsers = await transformMapper.select().returnAll();
    expect(readUsers).toEqual([
      User.create(1, user1),
      User.create(2, user2),
      User.create(3, user3),
    ]);

    ignore('check compile-time types', () => {
      // @ts-expect-error - only insertable objecs are allowed
      compilation.returnOne(USERS[0]);
      // @ts-expect-error - only insertable objecs are allowed
      compilation.run(USERS[0]);
    });
  });

  it('requires all indicated columns to be inserted', async () => {
    const compilation = userMapperReturningAll
      .insert()
      .columns(['name', 'handle', 'email'])
      .compile();
    expect(() =>
      compilation.returnOne({ name: 'John Doe', handle: 'johndoe' })
    ).rejects.toThrow(`column 'email' missing`);
  });
});
