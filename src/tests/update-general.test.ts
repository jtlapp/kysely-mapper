import { Kysely, sql } from 'kysely';

import { createDB, resetDB, destroyDB } from './utils/test-setup';
import { Database } from './utils/test-tables';
import {
  createUserMapperReturningDefault,
  createUserMapperReturningID,
  createUserMapperReturningIDAndHandleAsH,
  createUserMapperReturningAll,
  createUserMapperReturningNothing,
} from './utils/test-mappers';
import { USERS } from './utils/test-objects';
import { ignore } from './utils/test-utils';

let db: Kysely<Database>;
let userMapperReturningDefault: ReturnType<
  typeof createUserMapperReturningDefault
>;
let userMapperReturningNothing: ReturnType<
  typeof createUserMapperReturningNothing
>;
let userMapperReturningID: ReturnType<typeof createUserMapperReturningID>;
let userMapperReturningIDAndHandleAsH: ReturnType<
  typeof createUserMapperReturningIDAndHandleAsH
>;
let userMapperReturningAll: ReturnType<typeof createUserMapperReturningAll>;

beforeAll(async () => {
  db = await createDB();
  userMapperReturningDefault = createUserMapperReturningDefault(db);
  userMapperReturningNothing = createUserMapperReturningNothing(db);
  userMapperReturningID = createUserMapperReturningID(db);
  userMapperReturningIDAndHandleAsH =
    createUserMapperReturningIDAndHandleAsH(db);
  userMapperReturningAll = createUserMapperReturningAll(db);
});
beforeEach(() => resetDB(db));
afterAll(() => destroyDB(db));

describe('general update', () => {
  it('updates nothing returning zero update count', async () => {
    const updateValues = { email: 'new.email@xyz.pdq' };

    const success = await userMapperReturningAll
      .update({ id: 1 })
      .run(updateValues);
    expect(success).toBe(false);

    const updateCount = await userMapperReturningAll
      .update({ id: 1 })
      .returnCount(updateValues);
    expect(updateCount).toEqual(0);

    const updates = await userMapperReturningID
      .update({ id: 1 })
      .returnAll(updateValues);
    expect(updates.length).toEqual(0);

    const update = await userMapperReturningID
      .update({ id: 1 })
      .returnOne(updateValues);
    expect(update).toBeNull();

    const compilation = userMapperReturningID
      .update({ id: 1 })
      .columns(['handle', 'name', 'email'])
      .compile();

    const success2 = await compilation.run({}, updateValues);
    expect(success2).toBe(false);

    const updateCount2 = await compilation.returnCount({}, updateValues);
    expect(updateCount2).toEqual(0);

    const updates2 = await compilation.returnAll({}, updateValues);
    expect(updates2.length).toEqual(0);

    const update2 = await compilation.returnOne({}, updateValues);
    expect(update2).toBeNull();
  });

  it('updates something returning non-zero update count', async () => {
    const updateValues = { email: 'new.email@xyz.pdq' };
    const insertReturn0 = await userMapperReturningID
      .insert()
      .returnOne(USERS[0]);
    await userMapperReturningID.insert().run(USERS[1]);
    await userMapperReturningID.insert().run(USERS[2]);

    const updateCount1 = await userMapperReturningAll
      .update({ id: insertReturn0.id })
      .returnCount(updateValues);
    expect(updateCount1).toEqual(1);

    const readUser1 = await userMapperReturningID
      .select('id', '=', insertReturn0.id)
      .returnOne();
    expect(readUser1?.email).toEqual(updateValues.email);

    const updateCount2 = await userMapperReturningAll
      .update({ name: 'Sue' })
      .returnCount(updateValues);
    expect(updateCount2).toEqual(2);

    const readUsers = await userMapperReturningID
      .select('name', '=', 'Sue')
      .returnAll();
    expect(readUsers.length).toEqual(2);
    expect(readUsers[0].email).toEqual(updateValues.email);
    expect(readUsers[1].email).toEqual(updateValues.email);

    const updates = await userMapperReturningID.update().returnAll({
      name: 'Every User 1',
    });
    expect(updates).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);

    const update = await userMapperReturningID
      .update({ id: readUsers[0].id })
      .returnOne({
        name: 'Every User 2',
      });
    expect(update).toEqual({ id: 1 });
    const readUser2 = await userMapperReturningID
      .select('id', '=', 1)
      .returnOne();
    expect(readUser2?.name).toEqual('Every User 2');

    const updateCount = await userMapperReturningID.update().returnCount({
      name: 'Every User 3',
    });
    expect(updateCount).toEqual(3);

    const success = await userMapperReturningID.update().run({
      name: 'Every User 4',
    });
    expect(success).toBe(true);
  });

  it('updates returning configured return columns', async () => {
    await userMapperReturningID.insert().run(USERS[0]);
    const insertReturn = await userMapperReturningID
      .insert()
      .returnOne(USERS[1]);
    await userMapperReturningID.insert().run(USERS[2]);

    // Verify that update performs the correct change on the correct row.
    const updateValues1 = { email: 'new.email@xyz.pdq' };
    const updateReturns1 = await userMapperReturningID
      .update({ id: insertReturn.id })
      .returnAll(updateValues1);
    expect(updateReturns1).toEqual([{ id: insertReturn.id }]);
    let readUser = await userMapperReturningID
      .select('id', '=', insertReturn.id)
      .returnOne();
    expect(readUser?.email).toEqual(updateValues1.email);

    // Verify a different change on the same row, returning multiple columns.
    const updateValues2 = { name: 'Sue' };
    const updateReturns2 = await userMapperReturningIDAndHandleAsH
      .update({ email: updateValues1.email })
      .returnAll(updateValues2);
    updateReturns2[0].id; // ensure key is accessible
    updateReturns2[0].h; // ensure key is accessible
    expect(updateReturns2).toEqual([
      {
        id: insertReturn.id,
        h: USERS[1].handle,
      },
    ]);
    readUser = await userMapperReturningID
      .select('id', '=', insertReturn.id)
      .returnOne();
    expect(readUser?.name).toEqual(updateValues2.name);

    // Verify that update changes all required rows.
    const updateValues3 = { name: 'Replacement Sue' };
    const updateReturns3 = await userMapperReturningIDAndHandleAsH
      .update({ name: 'Sue' })
      .returnAll(updateValues3);
    expect(updateReturns3.length).toEqual(3);
    expect(updateReturns3[0].h).toEqual(USERS[0].handle);
    expect(updateReturns3[1].h).toEqual(USERS[1].handle);
    expect(updateReturns3[2].h).toEqual(USERS[2].handle);
    const readUsers = await userMapperReturningID
      .select('name', '=', updateValues3.name)
      .returnAll();
    expect(readUsers.length).toEqual(3);

    ignore('check return types', () => {
      // @ts-expect-error - check return types
      updateReturns2[0].title;
      // @ts-expect-error - check return types
      updateReturns2[0].userId;
    });
  });

  it('update returns void when defaulting to no return columns', async () => {
    await userMapperReturningID.insert().run(USERS);

    const updates = await userMapperReturningDefault
      .update({ name: 'Sue' })
      .returnAll({ email: 'new.email@xyz.pdq' });
    expect(updates).toBeUndefined();

    const readUsers = await userMapperReturningID
      .select({
        email: 'new.email@xyz.pdq',
      })
      .returnAll();
    expect(readUsers.length).toEqual(2);
  });

  it('update returns void when explicitly no return columns', async () => {
    await userMapperReturningID.insert().run(USERS);

    const updates = await userMapperReturningNothing
      .update({ name: 'Sue' })
      .returnAll({ email: 'new.email@xyz.pdq' });
    expect(updates).toBeUndefined();

    const readUsers = await userMapperReturningID
      .select({
        email: 'new.email@xyz.pdq',
      })
      .returnAll();
    expect(readUsers.length).toEqual(2);

    const update = await userMapperReturningNothing
      .update({ name: 'Sue' })
      .returnOne({ email: 'new2.email@xyz.pdq' });
    expect(update).toBeUndefined();

    const readUser = await userMapperReturningID
      .select({
        email: 'new2.email@xyz.pdq',
      })
      .returnOne();
    expect(readUser!.id).toEqual(1);

    ignore('type errors', () => {
      // @ts-expect-error - check return types
      updates[0].id;
      // @ts-expect-error - check return types
      update!.id;
    });
  });

  it('updates configured to return all columns', async () => {
    const insertReturns = await userMapperReturningID.insert().returnAll(USERS);

    const updateValues1 = { email: 'new.email@xyz.pdq' };
    const updateReturns = await userMapperReturningAll
      .update({ name: 'Sue' })
      .returnAll(updateValues1);

    const expectedUsers = [
      Object.assign({}, USERS[0], updateValues1, { id: insertReturns[0].id }),
      Object.assign({}, USERS[2], updateValues1, { id: insertReturns[2].id }),
    ];
    expect(updateReturns).toEqual(expectedUsers);
    // Ensure that the returned value can be accessed as a row.
    ((_: string) => {})(updateReturns[0].name);
    ((_: string | null) => {})(updateReturns[0].email);

    const updateValues2 = { email: 'another.email@xyz.pdq' };
    const updateReturn = await userMapperReturningAll
      .update({ name: 'Sue' })
      .returnOne(updateValues2);

    const expectedUser = Object.assign({}, USERS[0], updateValues2, {
      id: insertReturns[0].id,
    });
    expect(updateReturn).toEqual(expectedUser);
    // Ensure that the returned value can be accessed as a row.
    ((_: string) => {})(updateReturn!.name);
    ((_: string | null) => {})(updateReturn!.email);
  });

  it('updates all rows when no filter is given', async () => {
    const insertReturns = await userMapperReturningID.insert().returnAll(USERS);

    const updateValues = { email: 'new.email@xyz.pdq' };
    const updateReturns = await userMapperReturningIDAndHandleAsH
      .update()
      .returnAll(updateValues);

    const expectedUsers = USERS.map((user, i) => ({
      id: insertReturns[i].id,
      h: user.handle,
    }));
    expect(updateReturns).toEqual(expectedUsers);

    const readUsers = await userMapperReturningID.select().returnAll();
    expect(readUsers.length).toEqual(3);
    for (const user of readUsers) {
      expect(user.email).toEqual(updateValues.email);
    }
  });

  it('updates rows indicated by a binary operator', async () => {
    const insertReturns = await userMapperReturningID.insert().returnAll(USERS);

    const updateValues = { email: 'new.email@xyz.pdq' };
    const updateCount = await userMapperReturningAll
      .update('id', '>', insertReturns[0].id)
      .returnCount(updateValues);
    expect(updateCount).toEqual(2);

    const readUsers = await userMapperReturningID
      .select('id', '>', insertReturns[0].id)
      .returnAll();
    expect(readUsers.length).toEqual(2);
    for (const user of readUsers) {
      expect(user.email).toEqual(updateValues.email);
    }
  });

  it('updates rows indicated by a kysely expression', async () => {
    const insertReturns = await userMapperReturningID.insert().returnAll(USERS);

    const updateValues = { email: 'new.email@xyz.pdq' };
    const updateCount = await userMapperReturningDefault
      .update(sql`id > ${insertReturns[0].id}`)
      .returnCount(updateValues);
    expect(updateCount).toEqual(BigInt(2));

    const readUsers = await userMapperReturningID
      .select('id', '>', insertReturns[0].id)
      .returnAll();
    expect(readUsers.length).toEqual(2);
    for (const user of readUsers) {
      expect(user.email).toEqual(updateValues.email);
    }
  });

  it('updates rows indicated by a where expression filter', async () => {
    const insertReturns = await userMapperReturningID.insert().returnAll(USERS);

    const updateValues1 = { email: 'foo@xyz.pdq' };
    const updateCount = await userMapperReturningAll
      .update(({ or, cmpr }) =>
        or([
          cmpr('id', '=', insertReturns[0].id),
          cmpr('id', '=', insertReturns[2].id),
        ])
      )
      .returnCount(updateValues1);
    expect(updateCount).toEqual(2);

    const updateValues2 = { email: 'bar@xyz.pdq' };
    const updateReturns = await userMapperReturningID
      .update(({ or, cmpr }) =>
        or([
          cmpr('id', '=', insertReturns[0].id),
          cmpr('id', '=', insertReturns[2].id),
        ])
      )
      .returnAll(updateValues2);
    expect(updateReturns).toEqual([
      { id: insertReturns[0].id },
      { id: insertReturns[2].id },
    ]);
  });

  ignore('detects update type errors', async () => {
    userMapperReturningID.update(
      // @ts-expect-error - table must have all filter fields
      { notThere: 'xyz' }
    );
    // @ts-expect-error - table must have all filter fields
    userMapperReturningID.update('notThere', '=', 'foo');
    userMapperReturningID.update(({ or, cmpr }) =>
      // @ts-expect-error - only table columns are accessible via anyOf()
      or([cmpr('notThere', '=', 'xyz'), cmpr('alsoNotThere', '=', 'Sue')])
    );
    // @ts-expect-error - ID filter must have correct type
    userMapperReturningID.update('str');
    // @ts-expect-error - ID filter must have correct type
    userMapperReturningID.update(['str']);
    // @ts-expect-error - ID filter not allowed when when no ID column
    userMapperReturningNothing.update(1);
    // @ts-expect-error - ID filter not allowed when when no ID column
    userMapperReturningNothing.update([1]);

    userMapperReturningID.update({ id: 32 }).returnAll(
      // @ts-expect-error - update must only have table columns
      { notThere: 'xyz@pdq.xyz' }
    );
    // @ts-expect-error - only requested columns are accessible
    // prettier-ignore
    (await userMapperReturningID.update({ id: 32 }).returnAll(USERS[0]))[0].name;

    userMapperReturningID.update({ id: 32 }).returnOne(
      // @ts-expect-error - update must only have table columns
      { notThere: 'xyz@pdq.xyz' }
    );
    // @ts-expect-error - only requested columns are accessible
    // prettier-ignore
    (await userMapperReturningID.update({ id: 32 }).returnOne(USERS[0]))[0].name;

    userMapperReturningID.update({ id: 32 }).returnCount(
      // @ts-expect-error - update must only have table columns
      { notThere: 'xyz@pdq.xyz' }
    );
    // @ts-expect-error - only requested columns are accessible
    // prettier-ignore
    (await userMapperReturningID.update({ id: 32 }).returnCount(USERS[0]))[0].name;

    userMapperReturningID.update({ id: 32 }).run(
      // @ts-expect-error - update must only have table columns
      { notThere: 'xyz@pdq.xyz' }
    );
    // @ts-expect-error - only requested columns are accessible
    // prettier-ignore
    (await userMapperReturningID.update({ id: 32 }).run(USERS[0]))[0].name;
  });
});
