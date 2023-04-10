import { Insertable, Kysely, Selectable } from "kysely";

import { TableLens } from "../lenses/table-lens/table-lens";
import { createDB, resetDB, destroyDB } from "./utils/test-setup";
import { Database, Posts } from "./utils/test-tables";
import {
  UserTableLensReturningDefault,
  UserTableLensReturningID,
  UserTableLensReturningAll,
  UserTableLensReturningNothing,
} from "./utils/test-lenses";
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
} from "./utils/test-objects";
import { ignore } from "./utils/test-utils";
import { InsertedUser, ReturnedUser } from "./utils/test-types";

let db: Kysely<Database>;

let userLensReturningDefault: UserTableLensReturningDefault;
let userLensReturningNothing: UserTableLensReturningNothing;
let userLensReturningID: UserTableLensReturningID;
let userLensReturningAll: UserTableLensReturningAll;

let postTableLens: TableLens<
  Database,
  "posts",
  ["*"],
  Selectable<Posts>,
  Insertable<Posts>,
  Partial<Insertable<Posts>>,
  ["*"],
  number
>;
let postTableLensReturningIDAndTitle: TableLens<
  Database,
  "posts",
  ["*"],
  Selectable<Posts>,
  Insertable<Posts>,
  Partial<Insertable<Posts>>,
  ["id", "title"],
  number
>;

beforeAll(async () => {
  db = await createDB();
  userLensReturningDefault = new UserTableLensReturningDefault(db);
  userLensReturningNothing = new UserTableLensReturningNothing(db);
  userLensReturningID = new UserTableLensReturningID(db);
  userLensReturningAll = new UserTableLensReturningAll(db);
  postTableLens = new TableLens(db, "posts", {
    countTransform: (count) => Number(count),
  });
  postTableLensReturningIDAndTitle = new TableLens(db, "posts", {
    returnColumns: ["id", "title"],
    countTransform: (count) => Number(count),
  });
});
beforeEach(() => resetDB(db));
afterAll(() => destroyDB(db));

ignore("requires return columns to have a consistent type", () => {
  new TableLens<Database, "users">(db, "users", {
    // @ts-expect-error - actual and declared return types must match
    returnColumns: ["id", "name"],
  });
  new TableLens<Database, "users", any, any, any, ["id"]>(db, "users", {
    // @ts-expect-error - actual and declared return types must match
    returnColumns: ["id", "name"],
  });
  new TableLens<Database, "users", any, any, any, ["id", "name"]>(db, "users", {
    // @ts-expect-error - actual and declared return types must match
    returnColumns: ["id"],
  });
  new TableLens<Database, "users", any, any, any, ["*"]>(db, "users", {
    // @ts-expect-error - actual and declared return types must match
    returnColumns: ["id"],
  });
  new TableLens<Database, "users", any, any, any, []>(db, "users", {
    // @ts-expect-error - actual and declared return types must match
    returnColumns: ["id"],
  });
  // TODO: not sure how to get this to error
  new TableLens<Database, "users", any, any, any, ["id", "name"]>(db, "users");
});

it("insertQB() allows for inserting rows", async () => {
  const user0 = (await userLensReturningID
    .insertQB()
    .values(USERS[0])
    .returningAll()
    .executeTakeFirst())!;

  const readUser0 = await userLensReturningAll
    .select(["id", "=", user0.id])
    .getOne();
  expect(readUser0?.handle).toEqual(USERS[0].handle);
  expect(readUser0?.email).toEqual(USERS[0].email);
});

describe("insert an array of objects without transformation", () => {
  it("inserts multiple without returning columns", async () => {
    const result = await userLensReturningDefault.insertNoReturns(USERS);
    expect(result).toBeUndefined();

    const readUsers = await userLensReturningAll.select().getMany();
    expect(readUsers.length).toEqual(3);
    for (let i = 0; i < USERS.length; i++) {
      expect(readUsers[i].handle).toEqual(USERS[i].handle);
    }
  });

  it("inserts multiple returning configured return columns", async () => {
    const insertReturns = await userLensReturningID.insert(USERS);
    expect(insertReturns.length).toEqual(3);
    for (let i = 0; i < USERS.length; i++) {
      expect(insertReturns[i].id).toBeGreaterThan(0);
      expect(Object.keys(insertReturns[i]).length).toEqual(1);
    }

    const readUsers = await userLensReturningAll.select().getMany();
    expect(readUsers.length).toEqual(3);
    for (let i = 0; i < USERS.length; i++) {
      expect(readUsers[i].handle).toEqual(USERS[i].handle);
    }

    const post0 = Object.assign({}, POSTS[0], { userId: insertReturns[0].id });
    const post1 = Object.assign({}, POSTS[1], { userId: insertReturns[1].id });
    const post2 = Object.assign({}, POSTS[2], { userId: insertReturns[2].id });
    const updaterPosts = await postTableLensReturningIDAndTitle.insert([
      post0,
      post1,
      post2,
    ]);
    expect(updaterPosts.length).toEqual(3);
    for (let i = 0; i < updaterPosts.length; i++) {
      expect(updaterPosts[i].id).toBeGreaterThan(0);
      expect(updaterPosts[i].title).toEqual(POSTS[i].title);
      expect(Object.keys(updaterPosts[i]).length).toEqual(2);
    }
  });

  it("inserts multiple returning no columns by default", async () => {
    const insertReturns = await userLensReturningDefault.insert(USERS);
    expect(insertReturns).toBeUndefined();

    const readUsers = await userLensReturningAll.select().getMany();
    expect(readUsers.length).toEqual(3);
    for (let i = 0; i < USERS.length; i++) {
      expect(readUsers[i].handle).toEqual(USERS[i].handle);
    }
  });

  it("inserts multiple explicitly returning no columns", async () => {
    const insertReturns = await userLensReturningNothing.insert(USERS);
    expect(insertReturns).toBeUndefined();

    const readUsers = await userLensReturningAll.select().getMany();
    expect(readUsers.length).toEqual(3);
    for (let i = 0; i < USERS.length; i++) {
      expect(readUsers[i].handle).toEqual(USERS[i].handle);
    }
  });

  it("inserts multiple configured to return all columns", async () => {
    const insertReturns = await userLensReturningAll.insert(USERS);
    for (let i = 0; i < USERS.length; i++) {
      expect(insertReturns[i].id).toBeGreaterThan(0);
    }
    expect(insertReturns).toEqual(
      USERS.map((user, i) =>
        Object.assign({}, user, { id: insertReturns[i].id })
      )
    );
  });

  ignore("detects inserting an array of objects type errors", async () => {
    // @ts-expect-error - inserted object must have all required columns
    userLensReturningAll.insert([{}]);
    // @ts-expect-error - inserted object must have all required columns
    userLensReturningAll.insertNoReturns([{}]);
    // @ts-expect-error - inserted object must have all required columns
    userLensReturningAll.insert([{ email: "xyz@pdq.xyz" }]);
    // @ts-expect-error - inserted object must have all required columns
    userLensReturningAll.insertNoReturns([{ email: "xyz@pdq.xyz" }]);
    // @ts-expect-error - only configured columns are returned
    (await userLensReturningID.insert([USERS[0]]))[0].handle;
    // @ts-expect-error - only configured columns are returned
    (await userLensReturningID.insertNoReturns([USERS[0]]))[0].handle;
  });
});

describe("inserting a single object without transformation", () => {
  it("inserts one returning no columns by default", async () => {
    const result = await userLensReturningDefault.insertNoReturns(USERS[0]);
    expect(result).toBeUndefined();

    const readUser0 = await userLensReturningAll
      .selectedColumnsQB()
      .where("email", "=", USERS[0].email)
      .executeTakeFirst();
    expect(readUser0?.email).toEqual(USERS[0].email);
  });

  it("inserts one explicitly returning no columns", async () => {
    const result = await userLensReturningNothing.insertNoReturns(USERS[0]);
    expect(result).toBeUndefined();

    const readUser0 = await userLensReturningAll
      .selectedColumnsQB()
      .where("email", "=", USERS[0].email)
      .executeTakeFirst();
    expect(readUser0?.email).toEqual(USERS[0].email);
  });

  it("inserts one returning configured return columns", async () => {
    const insertReturn = await userLensReturningID.insert(USERS[0]);
    expect(insertReturn.id).toBeGreaterThan(0);
    expect(Object.keys(insertReturn).length).toEqual(1);

    const readUser0 = await userLensReturningAll
      .selectedColumnsQB()
      .where("id", "=", insertReturn.id)
      .executeTakeFirst();
    expect(readUser0?.email).toEqual(USERS[0].email);

    const post0 = Object.assign({}, POSTS[0], { userId: insertReturn.id });
    const updaterPost = await postTableLensReturningIDAndTitle.insert(post0);
    expect(updaterPost.id).toBeGreaterThan(0);
    expect(updaterPost.title).toEqual(POSTS[0].title);
    expect(Object.keys(updaterPost).length).toEqual(2);

    const readPost0 = await postTableLens
      .selectedColumnsQB()
      .where("id", "=", updaterPost.id)
      .where("title", "=", updaterPost.title)
      .executeTakeFirst();
    expect(readPost0?.likeCount).toEqual(post0.likeCount);
  });

  it("inserts one configured to return all columns", async () => {
    const insertReturn = await userLensReturningAll.insert(USERS[0]);
    expect(insertReturn.id).toBeGreaterThan(0);
    const expectedUser = Object.assign({}, USERS[0], { id: insertReturn.id });
    expect(insertReturn).toEqual(expectedUser);
  });

  ignore("detects type errors inserting a single object", async () => {
    // @ts-expect-error - inserted object must have all required columns
    userLensReturningAll.insert({});
    // @ts-expect-error - inserted object must have all required columns
    userLensReturningAll.insertNoReturns({});
    // @ts-expect-error - inserted object must have all required columns
    userLensReturningAll.insert({ email: "xyz@pdq.xyz" });
    // @ts-expect-error - inserted object must have all required columns
    userLensReturningAll.insertNoReturns({ email: "xyz@pdq.xyz" });
    // @ts-expect-error - only requested columns are returned
    (await userLensReturningID.insert(USERS[0])).name;
    // @ts-expect-error - only requested columns are returned
    (await userLensReturningDefault.insertNoReturns(USERS[0])).name;
  });
});

describe("insertion transformation", () => {
  class InsertTransformLens extends TableLens<
    Database,
    "users",
    ["*"],
    Selectable<Database["users"]>,
    InsertedUser,
    Partial<InsertedUser>,
    ["id"],
    number
  > {
    constructor(db: Kysely<Database>) {
      super(db, "users", {
        insertTransform: (source) => ({
          name: `${source.firstName} ${source.lastName}`,
          handle: source.handle,
          email: source.email,
        }),
        returnColumns: ["id"],
        countTransform: (count) => Number(count),
      });
    }
  }

  it("transforms users for insertion without transforming return", async () => {
    const insertTransformLens = new InsertTransformLens(db);

    const insertReturn = await insertTransformLens.insert(insertedUser1);
    const readUser1 = await insertTransformLens
      .select({
        id: insertReturn.id,
      })
      .getOne();
    expect(readUser1?.name).toEqual(
      `${insertedUser1.firstName} ${insertedUser1.lastName}`
    );

    await insertTransformLens.insert([insertedUser2, insertedUser3]);
    const readUsers = await insertTransformLens
      .select()
      .filter(["id", ">", insertReturn.id])
      .getMany();
    expect(readUsers.length).toEqual(2);
    expect(readUsers[0].name).toEqual(
      `${insertedUser2.firstName} ${insertedUser2.lastName}`
    );
    expect(readUsers[1].name).toEqual(
      `${insertedUser3.firstName} ${insertedUser3.lastName}`
    );
  });

  it("transforms insertion return without transforming insertion", async () => {
    class InsertReturnTransformLens extends TableLens<
      Database,
      "users",
      ["*"],
      Selectable<Database["users"]>,
      Insertable<Database["users"]>,
      Partial<Insertable<Database["users"]>>,
      ["id"],
      number,
      ReturnedUser
    > {
      constructor(db: Kysely<Database>) {
        super(db, "users", {
          returnColumns: ["id"],
          insertReturnTransform: (source, returns) =>
            new ReturnedUser(
              returns.id,
              source.name.split(" ")[0],
              source.name.split(" ")[1],
              source.handle,
              source.email
            ),
          countTransform: (count) => Number(count),
        });
      }
    }
    const insertReturnTransformLens = new InsertReturnTransformLens(db);

    const insertReturn = await insertReturnTransformLens.insert(userRow1);
    expect(insertReturn).toEqual(insertReturnedUser1);

    const insertReturns = await insertReturnTransformLens.insert([
      userRow2,
      userRow3,
    ]);
    expect(insertReturns).toEqual([insertReturnedUser2, insertReturnedUser3]);
  });

  it("transforms insertion and insertion return", async () => {
    class InsertAndReturnTransformLens extends TableLens<
      Database,
      "users",
      ["*"],
      Selectable<Database["users"]>,
      InsertedUser,
      Partial<Insertable<Database["users"]>>,
      ["id"],
      number,
      ReturnedUser
    > {
      constructor(db: Kysely<Database>) {
        super(db, "users", {
          insertTransform: (source) => ({
            name: `${source.firstName} ${source.lastName}`,
            handle: source.handle,
            email: source.email,
          }),
          returnColumns: ["id"],
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
    const insertAndReturnTransformLens = new InsertAndReturnTransformLens(db);

    const insertReturn = await insertAndReturnTransformLens.insert(
      insertedUser1
    );
    expect(insertReturn).toEqual(insertReturnedUser1);

    const insertReturns = await insertAndReturnTransformLens.insert([
      insertedUser2,
      insertedUser3,
    ]);
    expect(insertReturns).toEqual([insertReturnedUser2, insertReturnedUser3]);
  });

  ignore("detects insertion transformation type errors", async () => {
    const insertTransformLens = new InsertTransformLens(db);

    // @ts-expect-error - requires InsertedObject as input
    await insertTransformLens.insert(USERS[0]);
    // @ts-expect-error - requires InsertedObject as input
    await insertTransformLens.insertNoReturns(USERS[0]);
    // @ts-expect-error - requires InsertedObject as input
    await insertTransformLens.insert(selectedUser1);
    // @ts-expect-error - requires InsertedObject as input
    await insertTransformLens.insertNoReturns(selectedUser1);
  });
});
