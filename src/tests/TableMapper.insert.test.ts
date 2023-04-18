import { Insertable, Kysely, Selectable, Updateable } from 'kysely';

import { TableMapper } from '../mappers/table-mapper';
import { createDB, resetDB, destroyDB } from './utils/test-setup';
import { Database, Posts } from './utils/test-tables';
import {
  createUserMapperReturningDefault,
  createUserMapperReturningID,
  createUserMapperReturningAll,
  createUserMapperReturningNothing,
  createVariableReturnTypeMapper,
} from './utils/test-mappers';
import {
  USERS,
  POSTS,
  userRow1,
  userRow2,
  userRow3,
  insertedUser1,
  insertedUser2,
  insertedUser3,
  insertReturnedUser1,
  insertReturnedUser2,
  insertReturnedUser3,
  selectedUser1,
} from './utils/test-objects';
import { ignore } from './utils/test-utils';
import {
  InsertedUser,
  ReturnedUser,
  SelectedUser,
  User,
} from './utils/test-types';

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
    returnColumns: ['*'],
  }).withTransforms({
    countTransform: (count) => Number(count),
  });
  postTableMapperReturningIDAndTitleAsT = new TableMapper(db, 'posts', {
    returnColumns: ['id', 'title as t'],
  }).withTransforms({
    countTransform: (count) => Number(count),
  });
});
beforeEach(() => resetDB(db));
afterAll(() => destroyDB(db));

ignore('requires return columns to have a consistent type', () => {
  new TableMapper<Database, 'users'>(db, 'users', {
    // @ts-expect-error - actual and declared return types must match
    returnColumns: ['id', 'name'],
  });
  new TableMapper<Database, 'users', ['id']>(db, 'users', {
    // @ts-expect-error - actual and declared return types must match
    returnColumns: ['id', 'name'],
  });
  new TableMapper<
    Database,
    'users',
    [],
    any,
    any,
    any,
    any,
    number,
    ['id', 'name']
  >(db, 'users', {
    // @ts-expect-error - actual and declared return types must match
    returnColumns: ['id'],
  });
  new TableMapper<Database, 'users', [], any, any, any, any, number, ['*']>(
    db,
    'users',
    {
      // @ts-expect-error - actual and declared return types must match
      returnColumns: ['id'],
    }
  );
  new TableMapper<Database, 'users', [], any, any, any, any, number, []>(
    db,
    'users',
    {
      // @ts-expect-error - actual and declared return types must match
      returnColumns: ['id'],
    }
  );
  // TODO: not sure how to get this to error
  new TableMapper<
    Database,
    'users',
    [],
    any,
    any,
    any,
    any,
    number,
    ['id', 'name']
  >(db, 'users');
});

describe('insert an array of objects without transformation', () => {
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
    const success = await userMapperReturningNothing.insert().run(USERS[0]);
    expect(success).toBe(true);

    const readUser0 = await userMapperReturningAll
      .select('email', '=', USERS[0].email!)
      .returnOne();
    expect(readUser0?.email).toEqual(USERS[0].email);
  });

  it('inserts one returning configured return columns', async () => {
    const insertReturn = await userMapperReturningID
      .insert()
      .returnOne(USERS[0]);
    expect(insertReturn.id).toBeGreaterThan(0);
    expect(Object.keys(insertReturn).length).toEqual(1);

    const readUser0 = await userMapperReturningAll
      .select('id', '=', insertReturn.id)
      .returnOne();
    expect(readUser0?.email).toEqual(USERS[0].email);

    const post0 = Object.assign({}, POSTS[0], { userId: insertReturn.id });
    const updateReturn = await postTableMapperReturningIDAndTitleAsT
      .insert()
      .returnOne(post0);
    expect(updateReturn.id).toBeGreaterThan(0);
    expect(updateReturn.t).toEqual(POSTS[0].title);
    expect(Object.keys(updateReturn).length).toEqual(2);

    const readPost0 = await postTableMapper
      .select(({ and, cmpr }) =>
        and([
          cmpr('id', '=', updateReturn.id),
          cmpr('title', '=', updateReturn.t),
        ])
      )
      .returnOne();
    expect(readPost0?.likeCount).toEqual(post0.likeCount);

    ignore('check return types', () => {
      // @ts-expect-error - check return types
      updateReturn.title;
      // @ts-expect-error - check return types
      updateReturn.userId;
    });
  });

  it('inserts one configured to return all columns', async () => {
    const insertReturn = await userMapperReturningAll
      .insert()
      .returnOne(USERS[0]);
    expect(insertReturn.id).toBeGreaterThan(0);
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

describe('insertion queries', () => {
  function createInsertTransformMapper(db: Kysely<Database>) {
    return new TableMapper(db, 'users', {
      returnColumns: ['id'],
    }).withTransforms({
      insertTransform: (source: InsertedUser) => ({
        name: `${source.firstName} ${source.lastName}`,
        handle: source.handle,
        email: source.email,
      }),
      countTransform: (count) => Number(count),
    });
  }

  it('transforms users for insertion without transforming return', async () => {
    const insertTransformMapper = createInsertTransformMapper(db);

    const insertReturn = await insertTransformMapper
      .insert()
      .returnOne(insertedUser1);
    const readUser1 = await insertTransformMapper
      .select({
        id: insertReturn.id,
      })
      .returnOne();
    expect(readUser1?.name).toEqual(
      `${insertedUser1.firstName} ${insertedUser1.lastName}`
    );

    await insertTransformMapper
      .insert()
      .returnAll([insertedUser2, insertedUser3]);
    const readUsers = await insertTransformMapper
      .select('id', '>', insertReturn.id)
      .returnAll();
    expect(readUsers.length).toEqual(2);
    expect(readUsers[0].name).toEqual(
      `${insertedUser2.firstName} ${insertedUser2.lastName}`
    );
    expect(readUsers[1].name).toEqual(
      `${insertedUser3.firstName} ${insertedUser3.lastName}`
    );
  });

  it('transforms insertion return without transforming insertion', async () => {
    const insertReturnTransformMapper = new TableMapper(db, 'users', {
      returnColumns: ['id'],
    }).withTransforms({
      insertReturnTransform: (source, returns) =>
        new ReturnedUser(
          returns.id,
          source.name.split(' ')[0],
          source.name.split(' ')[1],
          source.handle,
          source.email || null
        ),
      countTransform: (count) => Number(count),
    });

    const insertReturn = await insertReturnTransformMapper
      .insert()
      .returnOne(userRow1);
    expect(insertReturn).toEqual(insertReturnedUser1);

    const insertReturns = await insertReturnTransformMapper
      .insert()
      .returnAll([userRow2, userRow3]);
    expect(insertReturns).toEqual([insertReturnedUser2, insertReturnedUser3]);
  });

  it('transforms insertion and insertion return', async () => {
    const insertAndReturnTransformMapper = new TableMapper(db, 'users', {
      returnColumns: ['id'],
    }).withTransforms({
      insertTransform: (source: InsertedUser) => ({
        name: `${source.firstName} ${source.lastName}`,
        handle: source.handle,
        email: source.email,
      }),
      insertReturnTransform: (source: InsertedUser, returns) =>
        new ReturnedUser(
          returns.id,
          source.firstName,
          source.lastName,
          source.handle,
          source.email
        ),
      countTransform: (count) => Number(count),
    });

    const insertReturn = await insertAndReturnTransformMapper
      .insert()
      .returnOne(insertedUser1);
    expect(insertReturn).toEqual(insertReturnedUser1);

    const insertReturns = await insertAndReturnTransformMapper
      .insert()
      .returnAll([insertedUser2, insertedUser3]);
    expect(insertReturns).toEqual([insertReturnedUser2, insertReturnedUser3]);
  });

  it('returns SelectedObject when updates can return rows', async () => {
    const transformMapper = createVariableReturnTypeMapper(db, true);

    // test returnOne()
    const names1 = userRow1.name.split(' ');
    const expectedUser1 = SelectedUser.create(1, {
      firstName: names1[0],
      lastName: names1[1],
      handle: userRow1.handle,
      email: userRow1.email,
    });
    const insertReturn = await transformMapper.insert().returnOne(userRow1);
    expect(insertReturn).toEqual(expectedUser1);
    // ensure return type can be accessed as a SelectedUser
    ((_: string) => {})(insertReturn.firstName);

    const readUser = await transformMapper
      .select({
        id: insertReturn.id,
      })
      .returnOne();
    expect(readUser).toEqual(expectedUser1);

    // test returnAll()
    const names2 = userRow2.name.split(' ');
    const expectedUser2 = SelectedUser.create(2, {
      firstName: names2[0],
      lastName: names2[1],
      handle: userRow2.handle,
      email: userRow2.email,
    });
    const names3 = userRow3.name.split(' ');
    const expectedUser3 = SelectedUser.create(3, {
      firstName: names3[0],
      lastName: names3[1],
      handle: userRow3.handle,
      email: userRow3.email,
    });
    const insertReturns = await transformMapper
      .insert()
      .returnAll([userRow2, userRow3]);
    expect(insertReturns).toEqual([expectedUser2, expectedUser3]);
    // ensure return type can be accessed as a SelectedUser
    ((_: string) => {})(insertReturns[0].firstName);
    ((_: string) => {})(insertReturns[1].firstName);

    const readUsers = await transformMapper
      .select('id', '>', insertReturn.id)
      .returnAll();
    expect(readUsers).toEqual([expectedUser2, expectedUser3]);
  });

  it('subsets inserted columns, excluding ID', async () => {
    const subsetQuery = userMapperReturningID
      .insert()
      .columns(['name', 'handle']);
    const insertReturn = await subsetQuery.returnOne({
      id: 10,
      name: 'John Doe',
      handle: 'johndoe',
      email: 'jdoe@abc.def',
    });
    expect(insertReturn).toEqual({ id: expect.any(Number) });

    const readUser = await userMapperReturningID.select().returnAll();
    expect(readUser).toEqual([
      { id: 1, name: 'John Doe', handle: 'johndoe', email: null },
    ]);
  });

  it('subsets inserted columns, including ID', async () => {
    const subsetQuery = userMapperReturningNothing
      .insert()
      .columns(['id', 'name', 'handle']);
    await subsetQuery.run({
      id: 10,
      name: 'John Doe',
      handle: 'johndoe',
      email: 'jdoe@abc.def',
    });

    const readUser = await userMapperReturningID.select().returnAll();
    expect(readUser).toEqual([
      { id: 10, name: 'John Doe', handle: 'johndoe', email: null },
    ]);
  });

  it('requires all subsetted columns to be inserted', async () => {
    const subsetQuery = userMapperReturningID
      .insert()
      .columns(['name', 'handle', 'email']);
    expect(() =>
      subsetQuery.returnOne({ name: 'John Doe', handle: 'johndoe' })
    ).rejects.toThrow(`column 'email' missing`);
  });

  it('compiles an insert query with transformation', async () => {
    const transformMapper = new TableMapper(db, 'users', {
      returnColumns: ['id'],
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
    const user1 = new User(0, 'John', 'Doe', 'johndoe', 'jdoe@abc.def');
    const user2 = new User(0, 'Sam', 'Gamgee', 'sg', 'sg@abc.def');
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

  ignore('detects insertion transformation type errors', async () => {
    const insertTransformMapper = createInsertTransformMapper(db);

    // @ts-expect-error - requires InsertedObject as input
    await insertTransformMapper.insert().returnOne(USERS[0]);
    // @ts-expect-error - requires InsertedObject as input
    await insertTransformMapper.insert().run(USERS[0]);
    // @ts-expect-error - requires InsertedObject as input
    await insertTransformMapper.insert().returnOne(selectedUser1);
    // @ts-expect-error - requires InsertedObject as input
    await insertTransformMapper.insert().run(selectedUser1);
  });
});
