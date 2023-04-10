import { Insertable, Kysely, Selectable, sql } from "kysely";

import { TableLens } from "../lenses/table-lens/table-lens";
import { createDB, resetDB, destroyDB } from "./utils/test-setup";
import { Database } from "./utils/test-tables";
import {
  UserTableLensReturningDefault,
  UserTableLensReturningID,
  UserTableLensReturningIDAndHandle,
  UserTableLensReturningAll,
  UserTableLensReturningNothing,
} from "./utils/test-lenses";
import {
  userObject1,
  userRow1,
  userRow2,
  userRow3,
  USERS,
} from "./utils/test-objects";
import { ignore } from "./utils/test-utils";
import { ReturnedUser, UpdaterUser } from "./utils/test-types";

let db: Kysely<Database>;
let userLensReturningDefault: UserTableLensReturningDefault;
let userLensReturningNothing: UserTableLensReturningNothing;
let userLensReturningID: UserTableLensReturningID;
let userLensReturningIDAndHandle: UserTableLensReturningIDAndHandle;
let userLensReturningAll: UserTableLensReturningAll;

beforeAll(async () => {
  db = await createDB();
  userLensReturningDefault = new UserTableLensReturningDefault(db);
  userLensReturningNothing = new UserTableLensReturningNothing(db);
  userLensReturningID = new UserTableLensReturningID(db);
  userLensReturningIDAndHandle = new UserTableLensReturningIDAndHandle(db);
  userLensReturningAll = new UserTableLensReturningAll(db);
});
beforeEach(() => resetDB(db));
afterAll(() => destroyDB(db));

it("updateQB() allows for updating rows", async () => {
  const user1 = await userLensReturningID.insert(USERS[1]);
  const updater = { email: "new@baz.com" };

  await userLensReturningAll
    .updateQB()
    .set(updater)
    .where("id", "=", user1.id)
    .execute();

  const readUser1 = await userLensReturningAll
    .select({ id: user1.id })
    .getOne();
  expect(readUser1?.handle).toEqual(USERS[1].handle);
  expect(readUser1?.email).toEqual(updater.email);
});

describe("updating rows via TableLens", () => {
  it("updates returning zero update count", async () => {
    const updateValues = { email: "new.email@xyz.pdq" };
    const updateCount = await userLensReturningAll.updateCount(
      { id: 1 },
      updateValues
    );
    expect(updateCount).toEqual(0);

    const updates = await userLensReturningID.updateWhere(
      { id: 1 },
      updateValues
    );
    expect(updates.length).toEqual(0);
  });

  it("updates returning non-zero update count", async () => {
    const updateValues = { email: "new.email@xyz.pdq" };
    const insertReturn0 = await userLensReturningID.insert(USERS[0]);
    await userLensReturningID.insert(USERS[1]);
    await userLensReturningID.insert(USERS[2]);

    const updateCount1 = await userLensReturningAll.updateCount(
      { id: insertReturn0.id },
      updateValues
    );
    expect(updateCount1).toEqual(1);

    const readUser = await userLensReturningID
      .select(["id", "=", insertReturn0.id])
      .getOne();
    expect(readUser?.email).toEqual(updateValues.email);

    const updateCount2 = await userLensReturningAll.updateCount(
      { name: "Sue" },
      updateValues
    );
    expect(updateCount2).toEqual(2);

    const readUsers = await userLensReturningID
      .select()
      .filter(["name", "=", "Sue"])
      .getMany();
    expect(readUsers.length).toEqual(2);
    expect(readUsers[0].email).toEqual(updateValues.email);
    expect(readUsers[1].email).toEqual(updateValues.email);

    // prettier-ignore
    const updateCount = await userLensReturningID.updateCount({}, {
      name: "Every User",
    });
    expect(updateCount).toEqual(3);
  });

  it("updates returning configured return columns", async () => {
    await userLensReturningID.insert(USERS[0]);
    const insertReturn = await userLensReturningID.insert(USERS[1]);
    await userLensReturningID.insert(USERS[2]);

    // Verify that update performs the correct change on the correct row.
    const updateValues1 = { email: "new.email@xyz.pdq" };
    const updateReturns1 = await userLensReturningID.updateWhere(
      { id: insertReturn.id },
      updateValues1
    );
    expect(updateReturns1).toEqual([{ id: insertReturn.id }]);
    let readUser = await userLensReturningID
      .select(["id", "=", insertReturn.id])
      .getOne();
    expect(readUser?.email).toEqual(updateValues1.email);

    // Verify a different change on the same row, returning multiple columns.
    const updateValues2 = { name: "Sue" };
    const updateReturns2 = await userLensReturningIDAndHandle.updateWhere(
      { email: updateValues1.email },
      updateValues2
    );
    expect(updateReturns2).toEqual([
      {
        id: insertReturn.id,
        handle: USERS[1].handle,
      },
    ]);
    readUser = await userLensReturningID
      .select(["id", "=", insertReturn.id])
      .getOne();
    expect(readUser?.name).toEqual(updateValues2.name);

    // Verify that update changes all required rows.
    const updateValues3 = { name: "Replacement Sue" };
    const updateReturns3 = await userLensReturningIDAndHandle.updateWhere(
      { name: "Sue" },
      updateValues3
    );
    expect(updateReturns3.length).toEqual(3);
    expect(updateReturns3[0].handle).toEqual(USERS[0].handle);
    expect(updateReturns3[1].handle).toEqual(USERS[1].handle);
    expect(updateReturns3[2].handle).toEqual(USERS[2].handle);
    const readUsers = await userLensReturningID
      .select()
      .filter(["name", "=", updateValues3.name])
      .getMany();
    expect(readUsers.length).toEqual(3);
  });

  it("update returns void when defaulting to no return columns", async () => {
    await userLensReturningID.insert(USERS);

    const updates = await userLensReturningDefault.updateWhere(
      { name: "Sue" },
      { email: "new.email@xyz.pdq" }
    );
    expect(updates).toBeUndefined();

    const readUsers = await userLensReturningID
      .select()
      .filter({
        email: "new.email@xyz.pdq",
      })
      .getMany();
    expect(readUsers.length).toEqual(2);
  });

  it("update returns void when explicitly no return columns", async () => {
    await userLensReturningID.insert(USERS);

    const updates = await userLensReturningNothing.updateWhere(
      { name: "Sue" },
      { email: "new.email@xyz.pdq" }
    );
    expect(updates).toBeUndefined();

    const readUsers = await userLensReturningID
      .select()
      .filter({
        email: "new.email@xyz.pdq",
      })
      .getMany();
    expect(readUsers.length).toEqual(2);
  });

  it("updates configured to return all columns", async () => {
    const insertReturns = await userLensReturningID.insert(USERS);

    const updateValues = { email: "new.email@xyz.pdq" };
    const updateReturns = await userLensReturningAll.updateWhere(
      { name: "Sue" },
      updateValues
    );

    const expectedUsers = [
      Object.assign({}, USERS[0], updateValues, { id: insertReturns[0].id }),
      Object.assign({}, USERS[2], updateValues, { id: insertReturns[2].id }),
    ];
    expect(updateReturns).toEqual(expectedUsers);
  });

  it("updates all rows when no filter is given", async () => {
    const insertReturns = await userLensReturningID.insert(USERS);

    const updateValues = { email: "new.email@xyz.pdq" };
    const updateReturns = await userLensReturningIDAndHandle.updateWhere(
      {},
      updateValues
    );

    const expectedUsers = USERS.map((user, i) => {
      return { id: insertReturns[i].id, handle: user.handle };
    });
    expect(updateReturns).toEqual(expectedUsers);

    const readUsers = await userLensReturningID.select().getMany();
    expect(readUsers.length).toEqual(3);
    for (const user of readUsers) {
      expect(user.email).toEqual(updateValues.email);
    }
  });

  it("updates rows indicated by a binary operator", async () => {
    const insertReturns = await userLensReturningID.insert(USERS);

    const updateValues = { email: "new.email@xyz.pdq" };
    const updateCount = await userLensReturningAll.updateCount(
      ["id", ">", insertReturns[0].id],
      updateValues
    );
    expect(updateCount).toEqual(2);

    const readUsers = await userLensReturningID
      .select()
      .filter(["id", ">", insertReturns[0].id])
      .getMany();
    expect(readUsers.length).toEqual(2);
    for (const user of readUsers) {
      expect(user.email).toEqual(updateValues.email);
    }
  });

  it("updates rows indicated by a kysely expression", async () => {
    const insertReturns = await userLensReturningID.insert(USERS);

    const updateValues = { email: "new.email@xyz.pdq" };
    const updateCount = await userLensReturningDefault.updateCount(
      sql`id > ${insertReturns[0].id}`,
      updateValues
    );
    expect(updateCount).toEqual(2);

    const readUsers = await userLensReturningID
      .select()
      .filter(["id", ">", insertReturns[0].id])
      .getMany();
    expect(readUsers.length).toEqual(2);
    for (const user of readUsers) {
      expect(user.email).toEqual(updateValues.email);
    }
  });

  it("updates rows indicated by a where expression filter", async () => {
    const insertReturns = await userLensReturningID.insert(USERS);

    const updateValues1 = { email: "foo@xyz.pdq" };
    const updateCount = await userLensReturningAll.updateCount(
      ({ or, cmpr }) =>
        or([
          cmpr("id", "=", insertReturns[0].id),
          cmpr("id", "=", insertReturns[2].id),
        ]),
      updateValues1
    );
    expect(updateCount).toEqual(2);

    const updateValues2 = { email: "bar@xyz.pdq" };
    const updateReturns = await userLensReturningID.updateWhere(
      ({ or, cmpr }) =>
        or([
          cmpr("id", "=", insertReturns[0].id),
          cmpr("id", "=", insertReturns[2].id),
        ]),
      updateValues2
    );
    expect(updateReturns).toEqual([
      { id: insertReturns[0].id },
      { id: insertReturns[2].id },
    ]);
  });

  ignore("detects update() and update() type errors", async () => {
    userLensReturningID.updateCount(
      // @ts-expect-error - table must have all filter fields
      { notThere: "xyz" },
      { email: "abc@def.ghi" }
    );
    userLensReturningID.updateWhere(
      // @ts-expect-error - table must have all filter fields
      { notThere: "xyz" },
      { email: "abc@def.ghi" }
    );
    // @ts-expect-error - table must have all filter fields
    userLensReturningID.updateWhere(["notThere", "=", "foo"], {
      email: "abc@def.ghi",
    });
    // @ts-expect-error - table must have all filter fields
    userLensReturningID.updateWhere(["notThere", "=", "foo"], {
      email: "abc@def.ghi",
    });
    // @ts-expect-error - update must only have table columns
    userLensReturningID.updateWhere({ id: 32 }, { notThere: "xyz@pdq.xyz" });
    userLensReturningID.updateWhere(
      { id: 32 },
      // @ts-expect-error - update must only have table columns
      { notThere: "xyz@pdq.xyz" }
    );
    // @ts-expect-error - doesn't allow plain string expression filters
    userLensReturningID.updateWhere("name = 'John Doe'", USERS[0]);
    // @ts-expect-error - doesn't allow plain string expression filters
    userLensReturningID.updateWhere("name = 'John Doe'", USERS[0]);
    // @ts-expect-error - only requested columns are accessible
    (await userLensReturningID.updateWhere({ id: 32 }, USERS[0]))[0].name;
    // @ts-expect-error - only requested columns are accessible
    // prettier-ignore
    (await userLensReturningID.updateWhere({ id: 32 }, USERS[0]))[0].name;
    await userLensReturningID.updateCount(
      ({ or, cmpr }) =>
        // @ts-expect-error - only table columns are accessible via anyOf()
        or([cmpr("notThere", "=", "xyz"), cmpr("alsoNotThere", "=", "Sue")]),
      USERS[0]
    );
    await userLensReturningID.updateWhere(
      ({ or, cmpr }) =>
        // @ts-expect-error - only table columns are accessible via anyOf()
        or([cmpr("notThere", "=", "xyz"), cmpr("alsoNotThere", "=", "Sue")]),
      USERS[0]
    );
  });
});

describe("update transformation", () => {
  class UpdateTransformLens extends TableLens<
    Database,
    "users",
    ["*"],
    Selectable<Database["users"]>,
    Insertable<Database["users"]>,
    UpdaterUser,
    ["id"]
  > {
    constructor(db: Kysely<Database>) {
      super(db, "users", {
        updaterTransform: (source) => ({
          name: `${source.firstName} ${source.lastName}`,
          handle: source.handle,
          email: source.email,
        }),
        returnColumns: ["id"],
      });
    }
  }

  it("transforms users for update without transforming return", async () => {
    const lens = new UpdateTransformLens(db);

    const insertReturns = await lens.insert([userRow1, userRow2, userRow3]);
    const updaterUser1 = UpdaterUser.create(
      0,
      Object.assign({}, userObject1, { firstName: "Suzanne" })
    );

    const updateReturns = await lens.updateWhere(
      ({ or, cmpr }) =>
        or([
          cmpr("id", "=", insertReturns[0].id),
          cmpr("id", "=", insertReturns[2].id),
        ]),
      updaterUser1
    );
    expect(updateReturns).toEqual([
      { id: insertReturns[0].id },
      { id: insertReturns[2].id },
    ]);

    const readUsers = await lens
      .select()
      .modify((qb) => qb.orderBy("id"))
      .getMany();
    expect(readUsers).toEqual([
      Object.assign({}, userRow1, {
        id: insertReturns[0].id,
        name: "Suzanne Smith",
      }),
      Object.assign({}, userRow2, { id: insertReturns[1].id }),
      Object.assign({}, userRow1, {
        id: insertReturns[2].id,
        name: "Suzanne Smith",
      }),
    ]);
  });

  it("transforms update return without transforming update", async () => {
    class UpdateReturnTransformLens extends TableLens<
      Database,
      "users",
      ["*"],
      Selectable<Database["users"]>,
      Insertable<Database["users"]>,
      Partial<Insertable<Database["users"]>>,
      ["id"],
      ReturnedUser
    > {
      constructor(db: Kysely<Database>) {
        super(db, "users", {
          returnColumns: ["id"],
          updateReturnTransform: (source, returns) =>
            new ReturnedUser(
              returns.id,
              source.name ? source.name.split(" ")[0] : "(first)",
              source.name ? source.name.split(" ")[1] : "(last)",
              source.handle ? source.handle : "(handle)",
              source.email ? source.email : "(email)"
            ),
        });
      }
    }
    const updateReturnTransformLens = new UpdateReturnTransformLens(db);

    const insertReturn = await updateReturnTransformLens.insert(userRow1);
    const updateReturn = await updateReturnTransformLens.updateWhere(
      { id: insertReturn.id },
      { name: "Suzanne Smith" }
    );
    expect(updateReturn).toEqual([
      new ReturnedUser(
        insertReturn.id,
        "Suzanne",
        "Smith",
        "(handle)",
        "(email)"
      ),
    ]);
  });

  it("transforms update and update return", async () => {
    class UpdateAndReturnTransformLens extends TableLens<
      Database,
      "users",
      ["*"],
      Selectable<Database["users"]>,
      Insertable<Database["users"]>,
      UpdaterUser,
      ["id"],
      ReturnedUser
    > {
      constructor(db: Kysely<Database>) {
        super(db, "users", {
          updaterTransform: (source) => ({
            name: `${source.firstName} ${source.lastName}`,
            handle: source.handle,
            email: source.email,
          }),
          returnColumns: ["id"],
          updateReturnTransform: (source, returns) =>
            new ReturnedUser(
              returns.id,
              source.firstName,
              source.lastName,
              source.handle,
              source.email
            ),
        });
      }
    }
    const updateAndReturnTransformLens = new UpdateAndReturnTransformLens(db);

    const insertReturn = await updateAndReturnTransformLens.insert(userRow1);
    const updateReturn = await updateAndReturnTransformLens.updateWhere(
      { id: insertReturn.id },
      UpdaterUser.create(0, userObject1)
    );
    expect(updateReturn).toEqual([
      new ReturnedUser(
        insertReturn.id,
        userObject1.firstName,
        userObject1.lastName,
        userObject1.handle,
        userObject1.email
      ),
    ]);
  });
});
