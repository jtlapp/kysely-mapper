import { Kysely } from "kysely";

import { createDB, resetDB, destroyDB } from "./utils/test-setup";
import { Database } from "./utils/test-tables";
import {
  UserTableLensReturningAll,
  UserTableLensReturningDefault,
} from "./utils/test-lenses";
import { USERS } from "./utils/test-objects";
import { ignore } from "./utils/test-utils";
import { TableLens } from "../lenses/table-lens/table-lens";

let db: Kysely<Database>;
let userLens: UserTableLensReturningAll;

beforeAll(async () => {
  db = await createDB();
  userLens = new UserTableLensReturningAll(db);
});
beforeEach(() => resetDB(db));
afterAll(() => destroyDB(db));

it("BUILDER: deleteQB() allows for deleting rows", async () => {
  await userLens.insert(USERS[1]);

  const readUser1 = await userLens
    .select()
    .filter({ handle: USERS[1].handle })
    .getOne();
  expect(readUser1?.handle).toEqual(USERS[1].handle);
  expect(readUser1?.email).toEqual(USERS[1].email);

  const result = await userLens
    .deleteQB()
    .where("handle", "=", USERS[1].handle)
    .executeTakeFirst();
  expect(Number(result.numDeletedRows)).toEqual(1);

  const readUser2 = await userLens
    .select()
    .filter({ handle: USERS[1].handle })
    .getOne();
  expect(readUser2).toBeNull();
});

describe("BUILDER: deleting rows via TableLens", () => {
  it("BUILDER: deletes rows returning the deletion count as bigint default", async () => {
    const defaultLens = new UserTableLensReturningDefault(db);

    const count1 = await defaultLens
      .delete()
      .filter({ name: USERS[0].name })
      .run();
    expect(count1).toEqual(BigInt(0));

    await defaultLens.insert(USERS);

    const count2 = await defaultLens
      .delete()
      .filter({ name: USERS[0].name })
      .run();
    expect(count2).toEqual(BigInt(2));
    const users = await defaultLens.select().getMany();
    expect(users.length).toEqual(1);
    expect(users[0].handle).toEqual(USERS[1].handle);
  });

  it("BUILDER: deletes rows returning the deletion count inferred as a number", async () => {
    const testLens = new TableLens(db, "users", {
      countTransform: (count) => Number(count),
    });
    await testLens.insert(USERS);

    const count = await testLens.delete().filter({ name: USERS[0].name }).run();
    expect(count).toEqual(2);
  });

  it("BUILDER: deletes rows returning the deletion count as number", async () => {
    const count1 = await userLens
      .delete()
      .filter({ name: USERS[0].name })
      .run();
    expect(count1).toEqual(0);

    await userLens.insert(USERS);

    const count2 = await userLens
      .delete()
      .filter({ name: USERS[0].name })
      .run();
    expect(count2).toEqual(2);
    const users = await userLens.select().getMany();
    expect(users.length).toEqual(1);
    expect(users[0].handle).toEqual(USERS[1].handle);
  });

  it("BUILDER: deletes rows specified via compound filter", async () => {
    await userLens.insert(USERS);

    const count1 = await userLens
      .delete()
      .filter(({ and, cmpr }) =>
        and([
          cmpr("name", "=", USERS[0].name),
          cmpr("handle", "=", USERS[0].handle),
        ])
      )
      .run();
    expect(count1).toEqual(1);

    const count2 = await userLens
      .delete()
      .filter(({ or, cmpr }) =>
        or([
          cmpr("name", "=", USERS[0].name),
          cmpr("handle", "=", USERS[0].handle),
        ])
      )
      .run();
    expect(count2).toEqual(1);
  });

  it("BUILDER: deletes via parameterized queries", async () => {
    const parameterization = userLens
      .delete()
      .parameterize<{ targetName: string }>(({ q, param }) =>
        q.filter({ name: param("targetName") })
      );

    const count1 = await parameterization.run(db, {
      targetName: USERS[0].name,
    });
    expect(count1).toEqual(0);

    await userLens.insert(USERS);

    const count2 = await parameterization.run(db, {
      targetName: USERS[0].name,
    });
    expect(count2).toEqual(2);
    const users = await userLens.select().getMany();
    expect(users.length).toEqual(1);
    expect(users[0].handle).toEqual(USERS[1].handle);

    const count3 = await parameterization.run(db, {
      targetName: USERS[1].name,
    });
    expect(count3).toEqual(1);
    const users2 = await userLens.select().getMany();
    expect(users2.length).toEqual(0);

    ignore("BUILDER: parameterization type errors", () => {
      // @ts-expect-error - errors on invalid parameter names
      parameterization.run(db, { notThere: "foo" });
    });
  });

  ignore("BUILDER: detects deletion type errors", async () => {
    // @ts-expect-error - table must have all filter fields
    userLens.delete().filter({ notThere: "xyz" });
    // @ts-expect-error - table must have all filter fields
    userLens.delete().filter(["notThere", "=", "foo"]);
    // @ts-expect-error - doesn't allow plain string expression filters
    userLens.delete().filter("name = 'John Doe'");
    userLens.delete().filter(({ or, cmpr }) =>
      // @ts-expect-error - only table columns are accessible via anyOf()
      or([cmpr("notThere", "=", "xyz"), cmpr("alsoNotThere", "=", "Sue")])
    );
    userLens.delete().filter(({ or, cmpr }) =>
      // @ts-expect-error - only table columns are accessible via allOf()
      or([cmpr("notThere", "=", "xyz"), cmpr("alsoNotThere", "=", "Sue")])
    );
  });
});
