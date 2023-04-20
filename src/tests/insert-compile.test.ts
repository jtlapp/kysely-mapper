import { Kysely } from 'kysely';

import { TableMapper } from '../mappers/table-mapper';
import { createDB, resetDB, destroyDB } from './utils/test-setup';
import { Database } from './utils/test-tables';
import { USERS } from './utils/test-objects';
import { ignore } from './utils/test-utils';
import { User } from './utils/test-types';

let db: Kysely<Database>;

beforeAll(async () => {
  db = await createDB();
});
beforeEach(() => resetDB(db));
afterAll(() => destroyDB(db));

describe('compiled insertions', () => {
  it('compiles an insert query with transformation', async () => {
    const transformMapper = new TableMapper(db, 'users', {
      insertReturnColumns: ['id'],
    }).withTransforms({
      selectTransform: (row) => {
        const names = row.name.split(' ');
        return new User(row.id, names[0], names[1], row.handle, row.email);
      },
      insertTransform: (source: User) => ({
        name: `${source.firstName} ${source.lastName}`,
        handle: source.handle,
        email: source.email,
      }),
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
      .columns(['name', 'handle', 'email'])
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
});
