import { Insertable, Kysely, Selectable, Updateable } from 'kysely';

import { TableMapper } from '../mappers/table-mapper';
import { createDB, resetDB, destroyDB } from './utils/test-setup';
import { Database, Posts } from './utils/test-tables';
import {
  createUserMapperReturningDefault,
  createUserMapperReturningID,
  createUserMapperReturningAll,
  createUserMapperReturningNothing,
  createUserMapperReturningDifferently,
} from './utils/test-mappers';
import { USERS, POSTS } from './utils/test-objects';
import { ignore } from './utils/test-utils';

let db: Kysely<Database>;

let userMapperReturningDefault: ReturnType<
  typeof createUserMapperReturningDefault
>;
let userMapperReturningNothing: ReturnType<
  typeof createUserMapperReturningNothing
>;
let userMapperReturningID: ReturnType<typeof createUserMapperReturningID>;
let userMapperReturningAll: ReturnType<typeof createUserMapperReturningAll>;

let postTableMapper: TableMapper<
  Database,
  'posts',
  [],
  ['*'],
  Selectable<Posts>,
  Insertable<Posts>,
  Updateable<Posts>,
  number,
  ['*']
>;
let postTableMapperReturningIDAndTitleAsT: TableMapper<
  Database,
  'posts',
  [],
  ['*'],
  Selectable<Posts>,
  Insertable<Posts>,
  Updateable<Posts>,
  number,
  ['id', 'title as t']
>;

beforeAll(async () => {
  db = await createDB();
  userMapperReturningDefault = createUserMapperReturningDefault(db);
  userMapperReturningNothing = createUserMapperReturningNothing(db);
  userMapperReturningID = createUserMapperReturningID(db);
  userMapperReturningAll = createUserMapperReturningAll(db);
  postTableMapper = new TableMapper(db, 'posts', {
    insertReturnColumns: ['*'],
  }).withTransforms({
    countTransform: (count) => Number(count),
  });
  postTableMapperReturningIDAndTitleAsT = new TableMapper(db, 'posts', {
    insertReturnColumns: ['id', 'title as t'],
  }).withTransforms({
    countTransform: (count) => Number(count),
  });
});
beforeEach(() => resetDB(db));
afterAll(() => destroyDB(db));

describe('inserting a single object without transformation', () => {
  it('inserts one returning no columns by default', async () => {
    const success = await userMapperReturningDefault.insert().run(USERS[0]);
    expect(success).toBe(true);

    const readUser0 = await userMapperReturningAll
      .select('email', '=', USERS[0].email!)
      .returnOne();
    expect(readUser0?.email).toEqual(USERS[0].email);
  });

  it('inserts one explicitly returning no columns', async () => {
    const insertReturn = await userMapperReturningNothing
      .insert()
      .returnOne(USERS[0]);
    expect(insertReturn).toBe(undefined);

    const readUser0 = await userMapperReturningAll
      .select('email', '=', USERS[0].email!)
      .returnOne();
    expect(readUser0?.email).toEqual(USERS[0].email);

    ignore('type errors', () => {
      // @ts-expect-error - check return type
      insertReturn.id;
    });
  });

  it('inserts one returning configured return columns', async () => {
    const insertReturn1 = await userMapperReturningID
      .insert()
      .returnOne(USERS[0]);
    expect(insertReturn1.id).toBeGreaterThan(0);
    expect(Object.keys(insertReturn1).length).toEqual(1);

    const readUser0 = await userMapperReturningAll
      .select('id', '=', insertReturn1.id)
      .returnOne();
    expect(readUser0?.email).toEqual(USERS[0].email);

    const post0 = Object.assign({}, POSTS[0], { userId: insertReturn1.id });
    const insertReturn2 = await postTableMapperReturningIDAndTitleAsT
      .insert()
      .returnOne(post0);
    expect(insertReturn2.id).toBeGreaterThan(0);
    expect(insertReturn2.t).toEqual(POSTS[0].title);
    expect(Object.keys(insertReturn2).length).toEqual(2);

    const readPost0 = await postTableMapper
      .select(({ and, cmpr }) =>
        and([
          cmpr('id', '=', insertReturn2.id),
          cmpr('title', '=', insertReturn2.t),
        ])
      )
      .returnOne();
    expect(readPost0?.likeCount).toEqual(post0.likeCount);

    ignore('check return types', () => {
      // @ts-expect-error - check return types
      insertReturn1.title;
      // @ts-expect-error - check return types
      insertReturn1.userId;
      // @ts-expect-error - check return types
      insertReturn2.title;
      // @ts-expect-error - check return types
      insertReturn2.userId;
    });
  });

  it('inserts multiple returning differently for inserts and updates', async () => {
    const mapper = createUserMapperReturningDifferently(db);

    const insertReturn = await mapper.insert().returnOne(USERS[0]);
    expect(insertReturn).toEqual({
      id: 1,
      handle: USERS[0].handle,
    });
    // Ensure that returned objects can be accessed as expected.
    ((_: number) => {})(insertReturn.id);
    ((_: string) => {})(insertReturn.handle);

    const newHandle = 'newHandle';
    const updateReturn = await mapper
      .update(1)
      .returnOne({ handle: newHandle });
    expect(updateReturn).toEqual({
      name: USERS[0].name,
    });
    // Ensure that returned objects can be accessed as expected.
    ((_: string) => {})(updateReturn!.name);

    ignore('type errors', () => {
      // @ts-expect-error - check return types
      insertReturn.name;
      // @ts-expect-error - check return types
      updateReturn!.id;
    });
  });

  it('inserts one configured to return all columns', async () => {
    const insertReturn = await userMapperReturningAll
      .insert()
      .returnOne(USERS[0]);
    expect(insertReturn.id).toBeGreaterThan(0);
    expect(insertReturn.email).toEqual(USERS[0].email);
    const expectedUser = Object.assign({}, USERS[0], { id: insertReturn.id });
    expect(insertReturn).toEqual(expectedUser);
  });

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

  ignore('detects type errors inserting a single object', async () => {
    // @ts-expect-error - inserted object must have all required columns
    userMapperReturningAll.insert().returnOne({});
    // @ts-expect-error - inserted object must have all required columns
    userMapperReturningAll.insert().run({});
    // @ts-expect-error - inserted object must have all required columns
    userMapperReturningAll.insert().returnOne({ email: 'xyz@pdq.xyz' });
    // @ts-expect-error - inserted object must have all required columns
    userMapperReturningAll.insert().run({ email: 'xyz@pdq.xyz' });
    // @ts-expect-error - only requested columns are returned
    (await userMapperReturningID.insert().returnOne(USERS[0])).name;
    // @ts-expect-error - only requested columns are returned
    (await userMapperReturningDefault.insert().run(USERS[0])).name;
  });
});
