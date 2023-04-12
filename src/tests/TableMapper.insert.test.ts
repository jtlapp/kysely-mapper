import { Insertable, Kysely, Selectable } from 'kysely';

import { TableMapper } from '../mappers/table-mapper';
import { createDB, resetDB, destroyDB } from './utils/test-setup';
import { Database, Posts } from './utils/test-tables';
import {
  UserTableMapperReturningDefault,
  UserTableMapperReturningID,
  UserTableMapperReturningAll,
  UserTableMapperReturningNothing,
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
import { InsertedUser, ReturnedUser } from './utils/test-types';

let db: Kysely<Database>;

let userMapperReturningDefault: UserTableMapperReturningDefault;
let userMapperReturningNothing: UserTableMapperReturningNothing;
let userMapperReturningID: UserTableMapperReturningID;
let userMapperReturningAll: UserTableMapperReturningAll;

let postTableMapper: TableMapper<
  Database,
  'posts',
  ['*'],
  Selectable<Posts>,
  Insertable<Posts>,
  Partial<Insertable<Posts>>,
  ['*'],
  number
>;
let postTableMapperReturningIDAndTitle: TableMapper<
  Database,
  'posts',
  ['*'],
  Selectable<Posts>,
  Insertable<Posts>,
  Partial<Insertable<Posts>>,
  ['id', 'title'],
  number
>;

beforeAll(async () => {
  db = await createDB();
  userMapperReturningDefault = new UserTableMapperReturningDefault(db);
  userMapperReturningNothing = new UserTableMapperReturningNothing(db);
  userMapperReturningID = new UserTableMapperReturningID(db);
  userMapperReturningAll = new UserTableMapperReturningAll(db);
  postTableMapper = new TableMapper(db, 'posts', {
    countTransform: (count) => Number(count),
  });
  postTableMapperReturningIDAndTitle = new TableMapper(db, 'posts', {
    returnColumns: ['id', 'title'],
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
  new TableMapper<Database, 'users', any, any, any, ['id']>(db, 'users', {
    // @ts-expect-error - actual and declared return types must match
    returnColumns: ['id', 'name'],
  });
  new TableMapper<Database, 'users', any, any, any, ['id', 'name']>(
    db,
    'users',
    {
      // @ts-expect-error - actual and declared return types must match
      returnColumns: ['id'],
    }
  );
  new TableMapper<Database, 'users', any, any, any, ['*']>(db, 'users', {
    // @ts-expect-error - actual and declared return types must match
    returnColumns: ['id'],
  });
  new TableMapper<Database, 'users', any, any, any, []>(db, 'users', {
    // @ts-expect-error - actual and declared return types must match
    returnColumns: ['id'],
  });
  // TODO: not sure how to get this to error
  new TableMapper<Database, 'users', any, any, any, ['id', 'name']>(
    db,
    'users'
  );
});

describe('insert an array of objects without transformation', () => {
  it('inserts multiple via run() without returning columns', async () => {
    const success = await userMapperReturningDefault.insert().run(USERS);
    expect(success).toBe(true);

    const readUsers = await userMapperReturningAll.select().getAll();
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

  it('inserts multiple via getResult() without returning columns', async () => {
    const success = await userMapperReturningDefault.insert().getReturns(USERS);
    expect(success).toBe(true);

    const readUsers = await userMapperReturningAll.select().getAll();
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

  it('inserts multiple returning configured return columns', async () => {
    const insertReturns = await userMapperReturningID
      .insert()
      .getReturns(USERS);
    expect(insertReturns.length).toEqual(3);
    for (let i = 0; i < USERS.length; i++) {
      expect(insertReturns[i].id).toBeGreaterThan(0);
      expect(Object.keys(insertReturns[i]).length).toEqual(1);
    }

    const readUsers = await userMapperReturningAll.select().getAll();
    expect(readUsers.length).toEqual(3);
    for (let i = 0; i < USERS.length; i++) {
      expect(readUsers[i].handle).toEqual(USERS[i].handle);
    }

    const post0 = Object.assign({}, POSTS[0], { userId: insertReturns[0].id });
    const post1 = Object.assign({}, POSTS[1], { userId: insertReturns[1].id });
    const post2 = Object.assign({}, POSTS[2], { userId: insertReturns[2].id });
    const updaterPosts = await postTableMapperReturningIDAndTitle
      .insert()
      .getReturns([post0, post1, post2]);
    expect(updaterPosts.length).toEqual(3);
    for (let i = 0; i < updaterPosts.length; i++) {
      expect(updaterPosts[i].id).toBeGreaterThan(0);
      expect(updaterPosts[i].title).toEqual(POSTS[i].title);
      expect(Object.keys(updaterPosts[i]).length).toEqual(2);
    }
  });

  it('inserts multiple returning no columns by default', async () => {
    const insertReturns = await userMapperReturningDefault
      .insert()
      .getReturns(USERS);
    expect(insertReturns).toBeUndefined();

    const readUsers = await userMapperReturningAll.select().getAll();
    expect(readUsers.length).toEqual(3);
    for (let i = 0; i < USERS.length; i++) {
      expect(readUsers[i].handle).toEqual(USERS[i].handle);
    }
  });

  it('inserts multiple explicitly returning no columns', async () => {
    const insertReturns = await userMapperReturningNothing
      .insert()
      .getReturns(USERS);
    expect(insertReturns).toBeUndefined();

    const readUsers = await userMapperReturningAll.select().getAll();
    expect(readUsers.length).toEqual(3);
    for (let i = 0; i < USERS.length; i++) {
      expect(readUsers[i].handle).toEqual(USERS[i].handle);
    }
  });

  it('inserts multiple configured to return all columns', async () => {
    const insertReturns = await userMapperReturningAll
      .insert()
      .getReturns(USERS);
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
    userMapperReturningAll.insert().getReturns([{}]);
    // @ts-expect-error - inserted object must have all required columns
    userMapperReturningAll.insert().run([{}]);
    // @ts-expect-error - inserted object must have all required columns
    userMapperReturningAll.insert().getReturns([{ email: 'xyz@pdq.xyz' }]);
    // @ts-expect-error - inserted object must have all required columns
    userMapperReturningAll.insert().run([{ email: 'xyz@pdq.xyz' }]);
    // @ts-expect-error - only configured columns are returned
    (await userMapperReturningID.insert().getReturns([USERS[0]]))[0].handle;
    // @ts-expect-error - only configured columns are returned
    (await userMapperReturningID.insert().run([USERS[0]]))[0].handle;
  });
});

describe('inserting a single object without transformation', () => {
  it('inserts one returning no columns by default', async () => {
    const result = await userMapperReturningDefault.insert().run(USERS[0]);
    expect(result).toBeUndefined();

    const readUser0 = await userMapperReturningAll
      .select(['email', '=', USERS[0].email])
      .getOne();
    expect(readUser0?.email).toEqual(USERS[0].email);
  });

  it('inserts one explicitly returning no columns', async () => {
    const result = await userMapperReturningNothing.insert().run(USERS[0]);
    expect(result).toBeUndefined();

    const readUser0 = await userMapperReturningAll
      .select(['email', '=', USERS[0].email])
      .getOne();
    expect(readUser0?.email).toEqual(USERS[0].email);
  });

  it('inserts one returning configured return columns', async () => {
    const insertReturn = await userMapperReturningID
      .insert()
      .getReturns(USERS[0]);
    expect(insertReturn.id).toBeGreaterThan(0);
    expect(Object.keys(insertReturn).length).toEqual(1);

    const readUser0 = await userMapperReturningAll
      .select(['id', '=', insertReturn.id])
      .getOne();
    expect(readUser0?.email).toEqual(USERS[0].email);

    const post0 = Object.assign({}, POSTS[0], { userId: insertReturn.id });
    const updaterPost = await postTableMapperReturningIDAndTitle
      .insert()
      .getReturns(post0);
    expect(updaterPost.id).toBeGreaterThan(0);
    expect(updaterPost.title).toEqual(POSTS[0].title);
    expect(Object.keys(updaterPost).length).toEqual(2);

    const readPost0 = await postTableMapper
      .select(({ and, cmpr }) =>
        and([
          cmpr('id', '=', updaterPost.id),
          cmpr('title', '=', updaterPost.title),
        ])
      )
      .getOne();
    expect(readPost0?.likeCount).toEqual(post0.likeCount);
  });

  it('inserts one configured to return all columns', async () => {
    const insertReturn = await userMapperReturningAll
      .insert()
      .getReturns(USERS[0]);
    expect(insertReturn.id).toBeGreaterThan(0);
    const expectedUser = Object.assign({}, USERS[0], { id: insertReturn.id });
    expect(insertReturn).toEqual(expectedUser);
  });

  ignore('detects type errors inserting a single object', async () => {
    // @ts-expect-error - inserted object must have all required columns
    userMapperReturningAll.insert().getReturns({});
    // @ts-expect-error - inserted object must have all required columns
    userMapperReturningAll.insert().run({});
    // @ts-expect-error - inserted object must have all required columns
    userMapperReturningAll.insert().getReturns({ email: 'xyz@pdq.xyz' });
    // @ts-expect-error - inserted object must have all required columns
    userMapperReturningAll.insert().run({ email: 'xyz@pdq.xyz' });
    // @ts-expect-error - only requested columns are returned
    (await userMapperReturningID.insert().getReturns(USERS[0])).name;
    // @ts-expect-error - only requested columns are returned
    (await userMapperReturningDefault.insert().run(USERS[0])).name;
  });
});

describe('insertion transformation', () => {
  class InsertTransformMapper extends TableMapper<
    Database,
    'users',
    ['*'],
    Selectable<Database['users']>,
    InsertedUser,
    Partial<InsertedUser>,
    ['id'],
    number
  > {
    constructor(db: Kysely<Database>) {
      super(db, 'users', {
        insertTransform: (source) => ({
          name: `${source.firstName} ${source.lastName}`,
          handle: source.handle,
          email: source.email,
        }),
        returnColumns: ['id'],
        countTransform: (count) => Number(count),
      });
    }
  }

  it('transforms users for insertion without transforming return', async () => {
    const insertTransformMapper = new InsertTransformMapper(db);

    const insertReturn = await insertTransformMapper
      .insert()
      .getReturns(insertedUser1);
    const readUser1 = await insertTransformMapper
      .select({
        id: insertReturn.id,
      })
      .getOne();
    expect(readUser1?.name).toEqual(
      `${insertedUser1.firstName} ${insertedUser1.lastName}`
    );

    await insertTransformMapper
      .insert()
      .getReturns([insertedUser2, insertedUser3]);
    const readUsers = await insertTransformMapper
      .select(['id', '>', insertReturn.id])
      .getAll();
    expect(readUsers.length).toEqual(2);
    expect(readUsers[0].name).toEqual(
      `${insertedUser2.firstName} ${insertedUser2.lastName}`
    );
    expect(readUsers[1].name).toEqual(
      `${insertedUser3.firstName} ${insertedUser3.lastName}`
    );
  });

  it('transforms insertion return without transforming insertion', async () => {
    class InsertReturnTransformMapper extends TableMapper<
      Database,
      'users',
      ['*'],
      Selectable<Database['users']>,
      Insertable<Database['users']>,
      Partial<Insertable<Database['users']>>,
      ['id'],
      number,
      ReturnedUser
    > {
      constructor(db: Kysely<Database>) {
        super(db, 'users', {
          returnColumns: ['id'],
          insertReturnTransform: (source, returns) =>
            new ReturnedUser(
              returns.id,
              source.name.split(' ')[0],
              source.name.split(' ')[1],
              source.handle,
              source.email
            ),
          countTransform: (count) => Number(count),
        });
      }
    }
    const insertReturnTransformMapper = new InsertReturnTransformMapper(db);

    const insertReturn = await insertReturnTransformMapper
      .insert()
      .getReturns(userRow1);
    expect(insertReturn).toEqual(insertReturnedUser1);

    const insertReturns = await insertReturnTransformMapper
      .insert()
      .getReturns([userRow2, userRow3]);
    expect(insertReturns).toEqual([insertReturnedUser2, insertReturnedUser3]);
  });

  it('transforms insertion and insertion return', async () => {
    class InsertAndReturnTransformMapper extends TableMapper<
      Database,
      'users',
      ['*'],
      Selectable<Database['users']>,
      InsertedUser,
      Partial<Insertable<Database['users']>>,
      ['id'],
      number,
      ReturnedUser
    > {
      constructor(db: Kysely<Database>) {
        super(db, 'users', {
          insertTransform: (source) => ({
            name: `${source.firstName} ${source.lastName}`,
            handle: source.handle,
            email: source.email,
          }),
          returnColumns: ['id'],
          insertReturnTransform: (source, returns) =>
            new ReturnedUser(
              returns.id,
              source.firstName,
              source.lastName,
              source.handle,
              source.email
            ),
          countTransform: (count) => Number(count),
        });
      }
    }
    const insertAndReturnTransformMapper = new InsertAndReturnTransformMapper(
      db
    );

    const insertReturn = await insertAndReturnTransformMapper
      .insert()
      .getReturns(insertedUser1);
    expect(insertReturn).toEqual(insertReturnedUser1);

    const insertReturns = await insertAndReturnTransformMapper
      .insert()
      .getReturns([insertedUser2, insertedUser3]);
    expect(insertReturns).toEqual([insertReturnedUser2, insertReturnedUser3]);
  });

  ignore('detects insertion transformation type errors', async () => {
    const insertTransformMapper = new InsertTransformMapper(db);

    // @ts-expect-error - requires InsertedObject as input
    await insertTransformMapper.insert().getReturns(USERS[0]);
    // @ts-expect-error - requires InsertedObject as input
    await insertTransformMapper.insert().run(USERS[0]);
    // @ts-expect-error - requires InsertedObject as input
    await insertTransformMapper.insert().getReturns(selectedUser1);
    // @ts-expect-error - requires InsertedObject as input
    await insertTransformMapper.insert().run(selectedUser1);
  });
});
