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
  postTableMapperReturningIDAndTitleAsT = new TableMapper(db, 'posts', {
    insertReturnColumns: ['id', 'title as t'],
  }).withTransforms({
    countTransform: (count) => Number(count),
  });
});
beforeEach(() => resetDB(db));
afterAll(() => destroyDB(db));

describe('inserting an array of objects without transformation', () => {
  it('inserts readonly objects', async () => {
    const obj = {
      name: 'John Doe' as const,
      handle: 'johndoe' as const,
      email: 'abc@def.ghi' as const,
    } as const;
    await userMapperReturningAll.insert().run(obj);
    await userMapperReturningAll.insert().returnAll([obj]);
    await userMapperReturningAll.insert().returnOne(obj);
  });

  it('inserts multiple via run() without returning columns', async () => {
    const success = await userMapperReturningDefault.insert().run(USERS);
    expect(success).toBe(true);

    const readUsers = await userMapperReturningAll.select().returnAll();
    expect(readUsers.length).toEqual(3);
    for (let i = 0; i < USERS.length; i++) {
      expect(readUsers[i].handle).toEqual(USERS[i].handle);
    }

    ignore("can't access columns when returning nothing", () => {
      // @ts-expect-error - can't access columns when returning nothing
      result.id;
      // @ts-expect-error - can't access columns when returning nothing
      result[0].id;
    });
  });

  it('inserts multiple via returnAll() without returning columns', async () => {
    const results = await userMapperReturningDefault.insert().returnAll(USERS);
    expect(results).toBeUndefined();

    const readUsers = await userMapperReturningAll.select().returnAll();
    expect(readUsers.length).toEqual(3);
    for (let i = 0; i < USERS.length; i++) {
      expect(readUsers[i].handle).toEqual(USERS[i].handle);
    }

    ignore("can't access columns when returning nothing", () => {
      // @ts-expect-error - can't access columns when returning nothing
      results.id;
      // @ts-expect-error - can't access columns when returning nothing
      results[0].id;
    });
  });

  it('inserts multiple via returnOne() without returning columns', async () => {
    const results = await userMapperReturningDefault
      .insert()
      .returnOne(USERS[0]);
    expect(results).toBeUndefined();

    const readUsers = await userMapperReturningAll.select().returnAll();
    expect(readUsers.length).toEqual(1);
    expect(readUsers[0].handle).toEqual(USERS[0].handle);

    ignore("can't access columns when returning nothing", () => {
      // @ts-expect-error - can't access columns when returning nothing
      results.id;
      // @ts-expect-error - can't access columns when returning nothing
      results[0].id;
    });
  });

  it('inserts multiple returning configured return columns', async () => {
    const insertReturns = await userMapperReturningID.insert().returnAll(USERS);
    expect(insertReturns.length).toEqual(3);
    for (let i = 0; i < USERS.length; i++) {
      expect(insertReturns[i].id).toBeGreaterThan(0);
      expect(Object.keys(insertReturns[i]).length).toEqual(1);
    }

    const readUsers = await userMapperReturningAll.select().returnAll();
    expect(readUsers.length).toEqual(3);
    for (let i = 0; i < USERS.length; i++) {
      expect(readUsers[i].handle).toEqual(USERS[i].handle);
    }

    const post0 = Object.assign({}, POSTS[0], { userId: insertReturns[0].id });
    const post1 = Object.assign({}, POSTS[1], { userId: insertReturns[1].id });
    const post2 = Object.assign({}, POSTS[2], { userId: insertReturns[2].id });
    const updateReturns = await postTableMapperReturningIDAndTitleAsT
      .insert()
      .returnAll([post0, post1, post2]);
    expect(updateReturns.length).toEqual(3);
    for (let i = 0; i < updateReturns.length; i++) {
      expect(updateReturns[i].id).toBeGreaterThan(0);
      expect(updateReturns[i].t).toEqual(POSTS[i].title);
      expect(Object.keys(updateReturns[i]).length).toEqual(2);
    }

    ignore('check return types', () => {
      // @ts-expect-error - check return types
      updateReturns[0].title;
      // @ts-expect-error - check return types
      updateReturns[0].userId;
    });
  });

  it('inserts multiple returning no columns by default', async () => {
    const insertReturns = await userMapperReturningDefault
      .insert()
      .returnAll(USERS);
    expect(insertReturns).toBeUndefined();

    const readUsers = await userMapperReturningAll.select().returnAll();
    expect(readUsers.length).toEqual(3);
    for (let i = 0; i < USERS.length; i++) {
      expect(readUsers[i].handle).toEqual(USERS[i].handle);
    }
  });

  it('inserts multiple explicitly returning no columns', async () => {
    const insertReturns = await userMapperReturningNothing
      .insert()
      .returnAll(USERS);
    expect(insertReturns).toBeUndefined();

    const readUsers = await userMapperReturningAll.select().returnAll();
    expect(readUsers.length).toEqual(3);
    for (let i = 0; i < USERS.length; i++) {
      expect(readUsers[i].handle).toEqual(USERS[i].handle);
    }

    ignore("can't access columns when returning nothing", () => {
      // @ts-expect-error - can't access columns when returning nothing
      insertReturns[0].id;
    });
  });

  it('inserts multiple returning differently for inserts and updates', async () => {
    const mapper = createUserMapperReturningDifferently(db);

    const insertReturns = await mapper.insert().returnAll(USERS);
    expect(insertReturns.length).toEqual(3);
    expect(insertReturns[0]).toEqual({
      id: insertReturns[0].id,
      handle: USERS[0].handle,
    });
    // Ensure that returned objects can be accessed as expected.
    ((_: number) => {})(insertReturns[0].id);
    ((_: string) => {})(insertReturns[0].handle);

    const newHandle = 'newHandle';
    const updateReturns = await mapper
      .update(1)
      .returnAll({ handle: newHandle });
    expect(updateReturns.length).toEqual(1);
    expect(updateReturns[0]).toEqual({
      name: USERS[0].name,
    });
    // Ensure that returned objects can be accessed as expected.
    ((_: string) => {})(updateReturns[0].name);

    ignore('type errors', () => {
      // @ts-expect-error - check return types
      insertReturns[0].name;
      // @ts-expect-error - check return types
      updateReturns[0].id;
    });
  });

  it('inserts multiple configured to return all columns', async () => {
    const insertReturns = await userMapperReturningAll
      .insert()
      .returnAll(USERS);
    for (let i = 0; i < USERS.length; i++) {
      expect(insertReturns[i].id).toBeGreaterThan(0);
    }
    expect(insertReturns).toEqual(
      USERS.map((user, i) =>
        Object.assign({}, user, { id: insertReturns[i].id })
      )
    );
    // Ensure that returned objects can be accessed as expected.
    ((_: string) => {})(insertReturns[0].name);
  });

  ignore('detects inserting an array of objects type errors', async () => {
    // @ts-expect-error - inserted object must have all required columns
    userMapperReturningAll.insert().returnAll([{}]);
    // @ts-expect-error - inserted object must have all required columns
    userMapperReturningAll.insert().run([{}]);
    // @ts-expect-error - inserted object must have all required columns
    userMapperReturningAll.insert().returnAll([{ email: 'xyz@pdq.xyz' }]);
    // @ts-expect-error - inserted object must have all required columns
    userMapperReturningAll.insert().run([{ email: 'xyz@pdq.xyz' }]);
    // @ts-expect-error - only configured columns are returned
    (await userMapperReturningID.insert().returnAll([USERS[0]]))[0].handle;
    // @ts-expect-error - only configured columns are returned
    (await userMapperReturningID.insert().run([USERS[0]]))[0].handle;
  });
});
