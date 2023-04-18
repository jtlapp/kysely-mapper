import { Insertable, Kysely, Selectable, Updateable, sql } from 'kysely';

import { TableMapper } from '../mappers/table-mapper';
import { createDB, resetDB, destroyDB } from './utils/test-setup';
import { Database } from './utils/test-tables';
import {
  createUserMapperReturningDefault,
  createUserMapperReturningID,
  createUserMapperReturningIDAndHandleAsH,
  createUserMapperReturningAll,
  createUserMapperReturningNothing,
} from './utils/test-mappers';
import {
  userObject1,
  userRow1,
  userRow2,
  userRow3,
  USERS,
} from './utils/test-objects';
import { ignore } from './utils/test-utils';
import { ReturnedUser, UpdatingUser, User } from './utils/test-types';

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

describe('updating rows via TableMapper', () => {
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
  });

  it('updates configured to return all columns', async () => {
    const insertReturns = await userMapperReturningID.insert().returnAll(USERS);

    const updateValues = { email: 'new.email@xyz.pdq' };
    const updateReturns = await userMapperReturningAll
      .update({ name: 'Sue' })
      .returnAll(updateValues);

    const expectedUsers = [
      Object.assign({}, USERS[0], updateValues, { id: insertReturns[0].id }),
      Object.assign({}, USERS[2], updateValues, { id: insertReturns[2].id }),
    ];
    expect(updateReturns).toEqual(expectedUsers);
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

  it('subsets updating columns, excluding ID', async () => {
    const insertReturns = await userMapperReturningID.insert().returnAll(USERS);

    const updateValues = { id: 100, name: 'Sue Rex', email: 'rex@abc.def' };
    const subsetQuery = userMapperReturningID
      .update('id', '=', insertReturns[0].id)
      .columns(['name']);
    const updateReturns = await subsetQuery.returnAll(updateValues);
    expect(updateReturns).toEqual([{ id: insertReturns[0].id }]);

    const readUsers = await userMapperReturningID
      .select('id', '=', insertReturns[0].id)
      .returnOne();
    expect(readUsers).toEqual({
      id: insertReturns[0].id,
      name: 'Sue Rex',
      email: USERS[0].email,
      handle: USERS[0].handle,
    });
  });

  it('subsets updating columns, including ID', async () => {
    const insertReturns = await userMapperReturningID.insert().returnAll(USERS);

    const updateValues = { id: 100, name: 'Sue Rex', email: 'rex@abc.def' };
    const subsetQuery = userMapperReturningID

      .update('id', '=', insertReturns[0].id)
      .columns(['id', 'name', 'email']);
    const updateReturns = await subsetQuery.returnAll(updateValues);
    expect(updateReturns).toEqual([{ id: 100 }]);

    const readUsers = await userMapperReturningID
      .select('id', '=', 100)
      .returnOne();
    expect(readUsers).toEqual({
      id: 100,
      name: 'Sue Rex',
      email: 'rex@abc.def',
      handle: USERS[0].handle,
    });
  });

  it('requires all subsetted columns to be updated', async () => {
    const insertReturns = await userMapperReturningID.insert().returnAll(USERS);

    const updateValues = { name: 'Sue Rex' };
    const subsetQuery = userMapperReturningID
      .update('id', '=', insertReturns[0].id)
      .columns(['name', 'email']);
    expect(() => subsetQuery.returnAll(updateValues)).rejects.toThrow(
      `column 'email' missing`
    );
  });

  it('compiles a non-returning update query without transformation', async () => {
    const insertReturns = await userMapperReturningID.insert().returnAll(USERS);
    const compilation = userMapperReturningNothing
      .update('id', '=', insertReturns[0].id)
      .columns(['name', 'email'])
      .compile();

    // test run()
    const updateValues1 = { name: 'Sue Rex', email: 'srex@abc.def' };
    const updateReturns1 = await compilation.run({}, updateValues1);
    expect(updateReturns1).toBe(true);
    const readUser1 = await userMapperReturningID
      .select({ id: insertReturns[0].id })
      .returnOne();
    expect(readUser1?.name).toEqual(updateValues1.name);
    expect(readUser1?.email).toEqual(updateValues1.email);

    // test returnOne()
    const updateValues2 = { name: 'Johnny Rex', email: 'jrex@abc.def' };
    const updateReturns2 = await compilation.returnOne({}, updateValues2);
    expect(updateReturns2).toBeUndefined();
    const readUser2 = await userMapperReturningID
      .select({ id: insertReturns[0].id })
      .returnOne();
    expect(readUser2?.name).toEqual(updateValues2.name);
    expect(readUser2?.email).toEqual(updateValues2.email);

    // test returnAll()
    const updateReturns3 = await compilation.returnAll({}, updateValues1);
    expect(updateReturns3).toBeUndefined();

    // test returnCount()
    const updateReturns4 = await compilation.returnCount({}, updateValues2);
    expect(updateReturns4).toEqual(1);
  });

  it('compiles a returning update query without transformation', async () => {
    const insertReturns = await userMapperReturningID.insert().returnAll(USERS);
    const compilation = userMapperReturningIDAndHandleAsH
      .update('id', '=', insertReturns[0].id)
      .columns(['name', 'email'])
      .compile();

    // test run()
    const updateValues1 = { name: 'Sue Rex', email: 'srex@abc.def' };
    const updateReturns1 = await compilation.run({}, updateValues1);
    expect(updateReturns1).toBe(true);
    const readUser1 = await userMapperReturningID
      .select({ id: insertReturns[0].id })
      .returnOne();
    expect(readUser1?.name).toEqual(updateValues1.name);
    expect(readUser1?.email).toEqual(updateValues1.email);

    // test returnOne()
    const updateValues2 = { name: 'Johnny Rex', email: 'jrex@abc.def' };
    const updateReturns2 = await compilation.returnOne({}, updateValues2);
    expect(updateReturns2?.id).toEqual(insertReturns[0].id);
    expect(updateReturns2?.h).toEqual(USERS[0].handle);
    const readUser2 = await userMapperReturningID
      .select({ id: insertReturns[0].id })
      .returnOne();
    expect(readUser2?.name).toEqual(updateValues2.name);
    expect(readUser2?.email).toEqual(updateValues2.email);

    // test returnAll()
    const updateReturns3 = await compilation.returnAll({}, updateValues1);
    expect(updateReturns3[0].id).toEqual(insertReturns[0].id);
    expect(updateReturns3[0].h).toEqual(USERS[0].handle);

    // test returnCount()
    const updateReturns4 = await compilation.returnCount({}, updateValues2);
    expect(updateReturns4).toEqual(1);

    ignore('check compile-time types', () => {
      compilation.returnOne(
        {},
        {
          name: 'xyz',
          handle: 'pdq',
          email: 'abc@def.hij',
          // @ts-expect-error - only insertable columns are allowed
          notThere: 32,
        }
      );
      // @ts-expect-error - only expected columns are returned
      updateReturns2!.handle;
      // @ts-expect-error - only expected columns are returned
      updateReturns3[0].handle;
    });
  });

  it('parameterizes a returning update query without transformation', async () => {
    const insertReturns = await userMapperReturningID.insert().returnAll(USERS);

    const parameterization = userMapperReturningIDAndHandleAsH.parameterize<{
      id: number;
    }>(({ mapper, param }) =>
      mapper.update({ id: param('id') }).columns(['name'])
    );

    // test run()
    const updateValues1 = { name: 'Sue Rex' };
    const updateReturns1 = await parameterization.run(
      { id: insertReturns[0].id },
      updateValues1
    );
    expect(updateReturns1).toBe(true);

    // test returnOne()
    const updateValues2 = { name: 'Johnny Rex' };
    const updateReturns2 = await parameterization.returnOne(
      { id: insertReturns[1].id },
      updateValues2
    );
    expect(updateReturns2?.id).toEqual(insertReturns[1].id);
    expect(updateReturns2?.h).toEqual(USERS[1].handle);

    // test returnAll()
    const updateReturns3 = await parameterization.returnAll(
      { id: insertReturns[2].id },
      updateValues1
    );
    expect(updateReturns3[0].id).toEqual(insertReturns[2].id);
    expect(updateReturns3[0].h).toEqual(USERS[2].handle);

    // verify updates
    const readUsers = await userMapperReturningID.select().returnAll();
    expect(readUsers[0].name).toEqual(updateValues1.name);
    expect(readUsers[1].name).toEqual(updateValues2.name);
    expect(readUsers[2].name).toEqual(updateValues1.name);

    // test returnCount()
    const updateReturns4 = await parameterization.returnCount(
      { id: insertReturns[0].id },
      updateValues2
    );
    expect(updateReturns4).toEqual(1);
    const readUser = await userMapperReturningID
      .select({ id: insertReturns[0].id })
      .returnOne();
    expect(readUser?.name).toEqual(updateValues2.name);

    ignore('parameterization type errors', () => {
      // @ts-expect-error - errors on invalid parameter names
      parameterization.returnAll({ handle: 'foo' }, updateValues1);
      // @ts-expect-error - errors on invalid column names
      updateReturns2!.handle;
      // @ts-expect-error - errors on invalid column names
      updateReturns3[0].handle;
      userMapperReturningIDAndHandleAsH.parameterize<{ id: number }>(
        ({ mapper, param }) =>
          // @ts-expect-error - errors on invalid parameter name
          mapper.update({ id: param('handle') }).columns(['name'])
      );
      userMapperReturningIDAndHandleAsH.parameterize<{ id: string }>(
        ({ mapper, param }) =>
          // @ts-expect-error - errors on invalid parameter type
          mapper.update({ id: param('id') }).columns(['name'])
      );
      // @ts-expect-error - errors on invalid parameter value name
      parameterization.returnOne({ handle: 'foo' }, updateValues1);
      // @ts-expect-error - errors on invalid parameter value type
      parameterization.returnOne({ id: 'foo' }, updateValues1);
      parameterization.returnOne(
        { id: 1 },
        {
          name: 'xyz',
          handle: 'pdq',
          email: 'abc@def.hij',
          // @ts-expect-error - only updateable columns are allowed
          notThere: 32,
        }
      );
    });
  });

  ignore('detects update() and update() type errors', async () => {
    userMapperReturningID
      .update(
        // @ts-expect-error - table must have all filter fields
        { notThere: 'xyz' }
      )
      .returnCount({ email: 'abc@def.ghi' });
    userMapperReturningID
      .update(
        // @ts-expect-error - table must have all filter fields
        { notThere: 'xyz' }
      )
      .returnAll({ email: 'abc@def.ghi' });
    // @ts-expect-error - table must have all filter fields
    userMapperReturningID.update('notThere', '=', 'foo').returnAll({
      email: 'abc@def.ghi',
    });
    // @ts-expect-error - table must have all filter fields
    userMapperReturningID.update('notThere', '=', 'foo').returnAll({
      email: 'abc@def.ghi',
    });
    userMapperReturningID
      .update({ id: 32 })
      // @ts-expect-error - update must only have table columns
      .returnAll({ notThere: 'xyz@pdq.xyz' });
    userMapperReturningID.update({ id: 32 }).returnAll(
      // @ts-expect-error - update must only have table columns
      { notThere: 'xyz@pdq.xyz' }
    );
    // @ts-expect-error - only requested columns are accessible
    // prettier-ignore
    (await userMapperReturningID.update({ id: 32 }).returnAll(USERS[0]))[0].name;
    // @ts-expect-error - only requested columns are accessible
    // prettier-ignore
    (await userMapperReturningID.update({ id: 32 }).returnAll( USERS[0]))[0].name;
    await userMapperReturningID
      .update(({ or, cmpr }) =>
        // @ts-expect-error - only table columns are accessible via anyOf()
        or([cmpr('notThere', '=', 'xyz'), cmpr('alsoNotThere', '=', 'Sue')])
      )
      .returnCount(USERS[0]);
    await userMapperReturningID
      .update(({ or, cmpr }) =>
        // @ts-expect-error - only table columns are accessible via anyOf()
        or([cmpr('notThere', '=', 'xyz'), cmpr('alsoNotThere', '=', 'Sue')])
      )
      .returnAll(USERS[0]);
    // @ts-expect-error - ID filter must have correct type
    userMapperReturningID.update('str');
    // @ts-expect-error - ID filter must have correct type
    userMapperReturningID.update(['str']);
    // @ts-expect-error - ID filter not allowed when when no ID column
    userMapperReturningNothing.update(1);
    // @ts-expect-error - ID filter not allowed when when no ID column
    userMapperReturningNothing.update([1]);
  });
});

describe('update transformation', () => {
  class UpdateTransformMapper extends TableMapper<
    Database,
    'users',
    ['id'],
    ['*'],
    Selectable<Database['users']>,
    Insertable<Database['users']>,
    UpdatingUser,
    ['id']
  > {
    constructor(db: Kysely<Database>) {
      super(db, 'users', {
        returnColumns: ['id'],
      });
      this.transforms = {
        updateTransform: (source) => ({
          name: `${source.firstName} ${source.lastName}`,
          handle: source.handle,
          email: source.email,
        }),
      };
    }
  }

  it('transforms users for update without transforming return', async () => {
    const mapper = new UpdateTransformMapper(db);

    const insertReturns = await mapper
      .insert()
      .returnAll([userRow1, userRow2, userRow3]);
    const updatingUser1 = UpdatingUser.create(
      0,
      Object.assign({}, userObject1, { firstName: 'Suzanne' })
    );

    const updateReturns = await mapper
      .update(({ or, cmpr }) =>
        or([
          cmpr('id', '=', insertReturns[0].id),
          cmpr('id', '=', insertReturns[2].id),
        ])
      )
      .returnAll(updatingUser1);
    expect(updateReturns).toEqual([
      { id: insertReturns[0].id },
      { id: insertReturns[2].id },
    ]);

    const readUsers = await mapper
      .select()
      .modify((qb) => qb.orderBy('id'))
      .returnAll();
    expect(readUsers).toEqual([
      Object.assign({}, userRow1, {
        id: insertReturns[0].id,
        name: 'Suzanne Smith',
      }),
      Object.assign({}, userRow2, { id: insertReturns[1].id }),
      Object.assign({}, userRow1, {
        id: insertReturns[2].id,
        name: 'Suzanne Smith',
      }),
    ]);
  });

  it('transforms update return without transforming update', async () => {
    class UpdateReturnTransformMapper extends TableMapper<
      Database,
      'users',
      ['id'],
      ['*'],
      Selectable<Database['users']>,
      Insertable<Database['users']>,
      Updateable<Database['users']>,
      bigint,
      ['id'],
      false,
      false,
      ReturnedUser
    > {
      constructor(db: Kysely<Database>) {
        super(db, 'users', {
          returnColumns: ['id'],
        });
        this.transforms = {
          updateReturnTransform: (source, returns) =>
            new ReturnedUser(
              returns.id,
              source.name ? source.name.split(' ')[0] : '(first)',
              source.name ? source.name.split(' ')[1] : '(last)',
              source.handle ? source.handle : '(handle)',
              source.email ? source.email : '(email)'
            ),
        };
      }
    }
    const updateReturnTransformMapper = new UpdateReturnTransformMapper(db);

    const insertReturn = await updateReturnTransformMapper
      .insert()
      .returnOne(userRow1);
    const updateReturn = await updateReturnTransformMapper
      .update({ id: insertReturn.id })
      .returnAll({ name: 'Suzanne Smith' });
    expect(updateReturn).toEqual([
      new ReturnedUser(
        insertReturn.id,
        'Suzanne',
        'Smith',
        '(handle)',
        '(email)'
      ),
    ]);
  });

  it('transforms update and update return', async () => {
    class UpdateAndReturnTransformMapper extends TableMapper<
      Database,
      'users',
      ['id'],
      ['*'],
      Selectable<Database['users']>,
      Insertable<Database['users']>,
      UpdatingUser,
      bigint,
      ['id'],
      false,
      false,
      ReturnedUser
    > {
      constructor(db: Kysely<Database>) {
        super(db, 'users', {
          returnColumns: ['id'],
        });
        this.transforms = {
          updateTransform: (source) => ({
            name: `${source.firstName} ${source.lastName}`,
            handle: source.handle,
            email: source.email,
          }),
          updateReturnTransform: (source, returns) =>
            new ReturnedUser(
              returns.id,
              source.firstName,
              source.lastName,
              source.handle,
              source.email
            ),
        };
      }
    }
    const updateAndReturnTransformMapper = new UpdateAndReturnTransformMapper(
      db
    );

    const insertReturn = await updateAndReturnTransformMapper
      .insert()
      .returnOne(userRow1);
    const updateReturn = await updateAndReturnTransformMapper
      .update({ id: insertReturn.id })
      .returnAll(UpdatingUser.create(0, userObject1));
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

  it('compiles an update query with transformation', async () => {
    class UniformInsertTransformMapper extends TableMapper<
      Database,
      'users',
      ['id'],
      ['*'],
      User,
      User,
      User,
      number,
      ['*'],
      true,
      true
    > {
      constructor(db: Kysely<Database>) {
        super(db, 'users', {
          returnColumns: ['*'],
        });
        this.transforms = {
          selectTransform: (row) => {
            const names = row.name.split(' ');
            return new User(row.id, names[0], names[1], row.handle, row.email);
          },
          insertTransform: (source) => ({
            name: `${source.firstName} ${source.lastName}`,
            handle: source.handle,
            email: source.email,
          }),
          insertReturnTransform: (_source, returns) => {
            const names = returns.name.split(' ');
            return new User(
              returns.id,
              names[0],
              names[1],
              returns.handle,
              returns.email
            );
          },
          updateTransform: (source) => ({
            name: `${source.firstName} ${source.lastName}`,
            handle: source.handle,
            email: source.email,
          }),
          updateReturnTransform: (_source, returns) => {
            const names = returns.name.split(' ');
            return new User(
              returns.id,
              names[0],
              names[1],
              returns.handle,
              returns.email
            );
          },
          countTransform: (count) => Number(count),
        };
      }
    }
    const transformMapper = new UniformInsertTransformMapper(db);
    const user1 = new User(0, 'John', 'Doe', 'johndoe', 'jdoe@abc.def');
    const user2 = new User(0, 'Sam', 'Gamgee', 'sg', 'sg@abc.def');
    const user3 = new User(0, 'Sue', 'Rex', 'srex', 'srex@abc.def');
    const insertReturns = await transformMapper
      .insert()
      .returnAll([user1, user2, user3]);

    const compilation = transformMapper
      .update({ id: insertReturns[2].id })
      .columns(['name'])
      .compile();

    // test returnOne()
    const updateReturn1 = await compilation.returnOne({}, user1);
    const expectedUser1 = User.create(insertReturns[2].id, {
      firstName: user1.firstName,
      lastName: user1.lastName,
      handle: user3.handle,
      email: user3.email,
    });
    expect(updateReturn1).toEqual(expectedUser1);
    // Ensure that the provided columns are accessible
    ((_: string) => {})(updateReturn1!.firstName);
    const readUser1 = await transformMapper
      .select({ id: insertReturns[2].id })
      .returnOne();
    expect(readUser1).toEqual(expectedUser1);

    // test returnAll()
    const updateReturn2 = await compilation.returnAll({}, user2);
    const expectedUser2 = User.create(insertReturns[2].id, {
      firstName: user2.firstName,
      lastName: user2.lastName,
      handle: user3.handle,
      email: user3.email,
    });
    expect(updateReturn2[0]).toEqual(expectedUser2);
    // Ensure that the provided columns are accessible
    ((_: string) => {})(updateReturn2[0]!.firstName);
    const readUser2 = await transformMapper
      .select({ id: insertReturns[2].id })
      .returnOne();
    expect(readUser2).toEqual(expectedUser2);

    // test run()
    const success1 = await compilation.run({}, user1);
    expect(success1).toBe(true);
    const readUser3 = await transformMapper
      .select({ id: insertReturns[2].id })
      .returnOne();
    expect(readUser3).toEqual(expectedUser1);

    // test returnCount()
    const count = await compilation.returnCount({}, user2);
    expect(count).toEqual(1);
    const readUser4 = await transformMapper
      .select({ id: insertReturns[2].id })
      .returnOne();
    expect(readUser4).toEqual(expectedUser2);

    ignore('check compile-time types', async () => {
      // @ts-expect-error - only update objects are allowed
      compilation.returnOne({}, USERS[0]);
      // @ts-expect-error - only update objects are allowed
      compilation.returnAll({}, USERS[0]);
      // @ts-expect-error - only update objects are allowed
      compilation.returnCount({}, USERS[0]);
      // @ts-expect-error - only update objects are allowed
      compilation.run({}, USERS[0]);
      // @ts-expect-error - correct return is expected
      (await compilation.returnOne({}, user1))!.name;
      // @ts-expect-error - correct return is expected
      (await compilation.returnAll({}, user2))[0].name;
    });
  });

  it('parameterizes an update query with transformation', async () => {
    class UniformInsertTransformMapper extends TableMapper<
      Database,
      'users',
      ['id'],
      ['*'],
      User,
      User,
      User,
      number,
      ['id'],
      false,
      false,
      { id: number; firstName: string; lastName: string }
    > {
      constructor(db: Kysely<Database>) {
        super(db, 'users', {
          returnColumns: ['id'],
        });
        this.transforms = {
          selectTransform: (row) => {
            const names = row.name.split(' ');
            return new User(row.id, names[0], names[1], row.handle, row.email);
          },
          insertTransform: (source) => ({
            name: `${source.firstName} ${source.lastName}`,
            handle: source.handle,
            email: source.email,
          }),
          insertReturnTransform: (source, returns) => ({
            id: returns.id,
            firstName: source.firstName,
            lastName: source.lastName,
          }),
          updateTransform: (source) => ({
            name: `${source.firstName} ${source.lastName}`,
            handle: source.handle,
            email: source.email,
          }),
          updateReturnTransform: (source, returns) => ({
            id: returns.id,
            firstName: source.firstName,
            lastName: source.lastName,
          }),
          countTransform: (count) => Number(count),
        };
      }
    }
    const transformMapper = new UniformInsertTransformMapper(db);
    const user1 = new User(0, 'John', 'Doe', 'johndoe', 'jdoe@abc.def');
    const user2 = new User(0, 'Sam', 'Gamgee', 'sg', 'sg@abc.def');
    const user3 = new User(0, 'Sue', 'Rex', 'srex', 'srex@abc.def');
    const insertReturns = await transformMapper
      .insert()
      .returnAll([user1, user2, user3]);

    const parameterization = transformMapper.parameterize<{ id: number }>(
      ({ mapper, param }) =>
        mapper.update({ id: param('id') }).columns(['name'])
    );

    // test returnOne()
    const updateReturn1 = await parameterization.returnOne(
      { id: insertReturns[0].id },
      user2
    );
    const expectedReturn1 = {
      id: insertReturns[0].id,
      firstName: user2.firstName,
      lastName: user2.lastName,
    };
    expect(updateReturn1).toEqual(expectedReturn1);
    // Ensure that the provided columns are accessible
    ((_: string) => {})(updateReturn1!.firstName);

    // test returnAll()
    const updateReturn2 = await parameterization.returnAll(
      { id: insertReturns[1].id },
      user3
    );
    const expectedReturn2 = {
      id: insertReturns[1].id,
      firstName: user3.firstName,
      lastName: user3.lastName,
    };
    expect(updateReturn2[0]).toEqual(expectedReturn2);
    // Ensure that the provided columns are accessible
    ((_: string) => {})(updateReturn2[0]!.firstName);

    // test run()
    const success1 = await parameterization.run(
      { id: insertReturns[2].id },
      user1
    );
    const expectedReturn3 = {
      id: insertReturns[2].id,
      firstName: user1.firstName,
      lastName: user1.lastName,
    };
    expect(success1).toBe(true);

    // verify updates
    const readUsers = await transformMapper.select().returnAll();
    expect(readUsers).toEqual([
      User.create(expectedReturn1.id, {
        ...expectedReturn1,
        handle: user1.handle,
        email: user1.email!,
      }),
      User.create(expectedReturn2.id, {
        ...expectedReturn2,
        handle: user2.handle,
        email: user2.email!,
      }),
      User.create(expectedReturn3.id, {
        ...expectedReturn3,
        handle: user3.handle,
        email: user3.email!,
      }),
    ]);

    // test returnCount()
    const count = await parameterization.returnCount(
      { id: insertReturns[2].id },
      user2
    );
    expect(count).toEqual(1);
    const readUser = await transformMapper
      .select({ id: insertReturns[2].id })
      .returnOne();
    expect(readUser).toEqual(
      User.create(insertReturns[2].id, {
        ...expectedReturn1,
        handle: user3.handle,
        email: user3.email!,
      })
    );

    ignore('parameterization type errors', () => {
      // @ts-expect-error - errors on invalid parameter names
      parameterization.returnAll({ handle: 'foo' }, user1);
      // @ts-expect-error - errors on invalid column names
      updateReturn1!.handle;
      // @ts-expect-error - errors on invalid column names
      updateReturn2[0].handle;
      transformMapper.parameterize<{ id: number }>(({ mapper, param }) =>
        // @ts-expect-error - errors on invalid parameter name
        mapper.update({ id: param('handle') }).columns(['name'])
      );
      transformMapper.parameterize<{ id: string }>(({ mapper, param }) =>
        // @ts-expect-error - errors on invalid parameter type
        mapper.update({ id: param('id') }).columns(['name'])
      );
      // @ts-expect-error - errors on invalid parameter value name
      parameterization.returnOne({ handle: 'foo' }, user1);
      // @ts-expect-error - errors on invalid parameter value type
      parameterization.returnOne({ id: 'foo' }, user1);
      parameterization.returnOne(
        { id: 1 },
        {
          // @ts-expect-error - only updateable columns are allowed
          name: 'xyz',
          handle: 'pdq',
          email: 'abc@def.hij',
        }
      );
    });
  });
});
