import { Insertable, Kysely, Selectable, sql } from 'kysely';

import { TableMapper } from '../mappers/table-mapper';
import { createDB, resetDB, destroyDB } from './utils/test-setup';
import { Database } from './utils/test-tables';
import {
  UserTableMapperReturningDefault,
  UserTableMapperReturningID,
  UserTableMapperReturningIDAndHandle,
  UserTableMapperReturningAll,
  UserTableMapperReturningNothing,
} from './utils/test-mappers';
import {
  userObject1,
  userRow1,
  userRow2,
  userRow3,
  USERS,
} from './utils/test-objects';
import { ignore } from './utils/test-utils';
import { ReturnedUser, UpdaterUser } from './utils/test-types';

let db: Kysely<Database>;
let userMapperReturningDefault: UserTableMapperReturningDefault;
let userMapperReturningNothing: UserTableMapperReturningNothing;
let userMapperReturningID: UserTableMapperReturningID;
let userMapperReturningIDAndHandle: UserTableMapperReturningIDAndHandle;
let userMapperReturningAll: UserTableMapperReturningAll;

beforeAll(async () => {
  db = await createDB();
  userMapperReturningDefault = new UserTableMapperReturningDefault(db);
  userMapperReturningNothing = new UserTableMapperReturningNothing(db);
  userMapperReturningID = new UserTableMapperReturningID(db);
  userMapperReturningIDAndHandle = new UserTableMapperReturningIDAndHandle(db);
  userMapperReturningAll = new UserTableMapperReturningAll(db);
});
beforeEach(() => resetDB(db));
afterAll(() => destroyDB(db));

describe('updating rows via TableMapper', () => {
  it('updates returning zero update count', async () => {
    const updateValues = { email: 'new.email@xyz.pdq' };
    const updateCount = await userMapperReturningAll
      .update({ id: 1 })
      .getCount(updateValues);
    expect(updateCount).toEqual(0);

    const updates = await userMapperReturningID
      .update({ id: 1 })
      .getReturns(updateValues);
    expect(updates.length).toEqual(0);
  });

  it('updates returning non-zero update count', async () => {
    const updateValues = { email: 'new.email@xyz.pdq' };
    const insertReturn0 = await userMapperReturningID
      .insert()
      .getReturns(USERS[0]);
    await userMapperReturningID.insert().run(USERS[1]);
    await userMapperReturningID.insert().run(USERS[2]);

    const updateCount1 = await userMapperReturningAll
      .update({ id: insertReturn0.id })
      .getCount(updateValues);
    expect(updateCount1).toEqual(1);

    const readUser = await userMapperReturningID
      .select(['id', '=', insertReturn0.id])
      .getOne();
    expect(readUser?.email).toEqual(updateValues.email);

    const updateCount2 = await userMapperReturningAll
      .update({ name: 'Sue' })
      .getCount(updateValues);
    expect(updateCount2).toEqual(2);

    const readUsers = await userMapperReturningID
      .select(['name', '=', 'Sue'])
      .getMany();
    expect(readUsers.length).toEqual(2);
    expect(readUsers[0].email).toEqual(updateValues.email);
    expect(readUsers[1].email).toEqual(updateValues.email);

    // prettier-ignore
    const updateCount = await userMapperReturningID.update().getCount( {
      name: "Every User",
    });
    expect(updateCount).toEqual(3);
  });

  it('updates returning configured return columns', async () => {
    await userMapperReturningID.insert().run(USERS[0]);
    const insertReturn = await userMapperReturningID
      .insert()
      .getReturns(USERS[1]);
    await userMapperReturningID.insert().run(USERS[2]);

    // Verify that update performs the correct change on the correct row.
    const updateValues1 = { email: 'new.email@xyz.pdq' };
    const updateReturns1 = await userMapperReturningID
      .update({ id: insertReturn.id })
      .getReturns(updateValues1);
    expect(updateReturns1).toEqual([{ id: insertReturn.id }]);
    let readUser = await userMapperReturningID
      .select(['id', '=', insertReturn.id])
      .getOne();
    expect(readUser?.email).toEqual(updateValues1.email);

    // Verify a different change on the same row, returning multiple columns.
    const updateValues2 = { name: 'Sue' };
    const updateReturns2 = await userMapperReturningIDAndHandle
      .update({ email: updateValues1.email })
      .getReturns(updateValues2);
    expect(updateReturns2).toEqual([
      {
        id: insertReturn.id,
        handle: USERS[1].handle,
      },
    ]);
    readUser = await userMapperReturningID
      .select(['id', '=', insertReturn.id])
      .getOne();
    expect(readUser?.name).toEqual(updateValues2.name);

    // Verify that update changes all required rows.
    const updateValues3 = { name: 'Replacement Sue' };
    const updateReturns3 = await userMapperReturningIDAndHandle
      .update({ name: 'Sue' })
      .getReturns(updateValues3);
    expect(updateReturns3.length).toEqual(3);
    expect(updateReturns3[0].handle).toEqual(USERS[0].handle);
    expect(updateReturns3[1].handle).toEqual(USERS[1].handle);
    expect(updateReturns3[2].handle).toEqual(USERS[2].handle);
    const readUsers = await userMapperReturningID
      .select(['name', '=', updateValues3.name])
      .getMany();
    expect(readUsers.length).toEqual(3);
  });

  it('update returns void when defaulting to no return columns', async () => {
    await userMapperReturningID.insert().run(USERS);

    const updates = await userMapperReturningDefault
      .update({ name: 'Sue' })
      .getReturns({ email: 'new.email@xyz.pdq' });
    expect(updates).toBeUndefined();

    const readUsers = await userMapperReturningID
      .select({
        email: 'new.email@xyz.pdq',
      })
      .getMany();
    expect(readUsers.length).toEqual(2);
  });

  it('update returns void when explicitly no return columns', async () => {
    await userMapperReturningID.insert().run(USERS);

    const updates = await userMapperReturningNothing
      .update({ name: 'Sue' })
      .getReturns({ email: 'new.email@xyz.pdq' });
    expect(updates).toBeUndefined();

    const readUsers = await userMapperReturningID
      .select({
        email: 'new.email@xyz.pdq',
      })
      .getMany();
    expect(readUsers.length).toEqual(2);
  });

  it('updates configured to return all columns', async () => {
    const insertReturns = await userMapperReturningID
      .insert()
      .getReturns(USERS);

    const updateValues = { email: 'new.email@xyz.pdq' };
    const updateReturns = await userMapperReturningAll
      .update({ name: 'Sue' })
      .getReturns(updateValues);

    const expectedUsers = [
      Object.assign({}, USERS[0], updateValues, { id: insertReturns[0].id }),
      Object.assign({}, USERS[2], updateValues, { id: insertReturns[2].id }),
    ];
    expect(updateReturns).toEqual(expectedUsers);
  });

  it('updates all rows when no filter is given', async () => {
    const insertReturns = await userMapperReturningID
      .insert()
      .getReturns(USERS);

    const updateValues = { email: 'new.email@xyz.pdq' };
    const updateReturns = await userMapperReturningIDAndHandle
      .update()
      .getReturns(updateValues);

    const expectedUsers = USERS.map((user, i) => {
      return { id: insertReturns[i].id, handle: user.handle };
    });
    expect(updateReturns).toEqual(expectedUsers);

    const readUsers = await userMapperReturningID.select().getMany();
    expect(readUsers.length).toEqual(3);
    for (const user of readUsers) {
      expect(user.email).toEqual(updateValues.email);
    }
  });

  it('updates rows indicated by a binary operator', async () => {
    const insertReturns = await userMapperReturningID
      .insert()
      .getReturns(USERS);

    const updateValues = { email: 'new.email@xyz.pdq' };
    const updateCount = await userMapperReturningAll
      .update(['id', '>', insertReturns[0].id])
      .getCount(updateValues);
    expect(updateCount).toEqual(2);

    const readUsers = await userMapperReturningID
      .select(['id', '>', insertReturns[0].id])
      .getMany();
    expect(readUsers.length).toEqual(2);
    for (const user of readUsers) {
      expect(user.email).toEqual(updateValues.email);
    }
  });

  it('updates rows indicated by a kysely expression', async () => {
    const insertReturns = await userMapperReturningID
      .insert()
      .getReturns(USERS);

    const updateValues = { email: 'new.email@xyz.pdq' };
    const updateCount = await userMapperReturningDefault
      .update(sql`id > ${insertReturns[0].id}`)
      .getCount(updateValues);
    expect(updateCount).toEqual(BigInt(2));

    const readUsers = await userMapperReturningID
      .select(['id', '>', insertReturns[0].id])
      .getMany();
    expect(readUsers.length).toEqual(2);
    for (const user of readUsers) {
      expect(user.email).toEqual(updateValues.email);
    }
  });

  it('updates rows indicated by a where expression filter', async () => {
    const insertReturns = await userMapperReturningID
      .insert()
      .getReturns(USERS);

    const updateValues1 = { email: 'foo@xyz.pdq' };
    const updateCount = await userMapperReturningAll
      .update(({ or, cmpr }) =>
        or([
          cmpr('id', '=', insertReturns[0].id),
          cmpr('id', '=', insertReturns[2].id),
        ])
      )
      .getCount(updateValues1);
    expect(updateCount).toEqual(2);

    const updateValues2 = { email: 'bar@xyz.pdq' };
    const updateReturns = await userMapperReturningID
      .update(({ or, cmpr }) =>
        or([
          cmpr('id', '=', insertReturns[0].id),
          cmpr('id', '=', insertReturns[2].id),
        ])
      )
      .getReturns(updateValues2);
    expect(updateReturns).toEqual([
      { id: insertReturns[0].id },
      { id: insertReturns[2].id },
    ]);
  });

  ignore('detects update() and update() type errors', async () => {
    userMapperReturningID
      .update(
        // @ts-expect-error - table must have all filter fields
        { notThere: 'xyz' }
      )
      .getCount({ email: 'abc@def.ghi' });
    userMapperReturningID
      .update(
        // @ts-expect-error - table must have all filter fields
        { notThere: 'xyz' }
      )
      .getReturns({ email: 'abc@def.ghi' });
    // @ts-expect-error - table must have all filter fields
    userMapperReturningID.update(['notThere', '=', 'foo']).getReturns({
      email: 'abc@def.ghi',
    });
    // @ts-expect-error - table must have all filter fields
    userMapperReturningID.update(['notThere', '=', 'foo']).getReturns({
      email: 'abc@def.ghi',
    });
    userMapperReturningID
      .update({ id: 32 })
      // @ts-expect-error - update must only have table columns
      .getReturns({ notThere: 'xyz@pdq.xyz' });
    userMapperReturningID.update({ id: 32 }).getReturns(
      // @ts-expect-error - update must only have table columns
      { notThere: 'xyz@pdq.xyz' }
    );
    // @ts-expect-error - doesn't allow plain string expression filters
    userMapperReturningID.update("name = 'John Doe'", USERS[0]);
    // @ts-expect-error - doesn't allow plain string expression filters
    userMapperReturningID.update("name = 'John Doe'", USERS[0]);
    // @ts-expect-error - only requested columns are accessible
    // prettier-ignore
    (await userMapperReturningID.update({ id: 32 }).getReturns(USERS[0]))[0].name;
    // @ts-expect-error - only requested columns are accessible
    // prettier-ignore
    (await userMapperReturningID.update({ id: 32 }).getReturns( USERS[0]))[0].name;
    await userMapperReturningID
      .update(({ or, cmpr }) =>
        // @ts-expect-error - only table columns are accessible via anyOf()
        or([cmpr('notThere', '=', 'xyz'), cmpr('alsoNotThere', '=', 'Sue')])
      )
      .getCount(USERS[0]);
    await userMapperReturningID
      .update(({ or, cmpr }) =>
        // @ts-expect-error - only table columns are accessible via anyOf()
        or([cmpr('notThere', '=', 'xyz'), cmpr('alsoNotThere', '=', 'Sue')])
      )
      .getReturns(USERS[0]);
  });
});

describe('update transformation', () => {
  class UpdateTransformMapper extends TableMapper<
    Database,
    'users',
    ['*'],
    Selectable<Database['users']>,
    Insertable<Database['users']>,
    UpdaterUser,
    ['id']
  > {
    constructor(db: Kysely<Database>) {
      super(db, 'users', {
        updaterTransform: (source) => ({
          name: `${source.firstName} ${source.lastName}`,
          handle: source.handle,
          email: source.email,
        }),
        returnColumns: ['id'],
      });
    }
  }

  it('transforms users for update without transforming return', async () => {
    const mapper = new UpdateTransformMapper(db);

    const insertReturns = await mapper
      .insert()
      .getReturns([userRow1, userRow2, userRow3]);
    const updaterUser1 = UpdaterUser.create(
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
      .getReturns(updaterUser1);
    expect(updateReturns).toEqual([
      { id: insertReturns[0].id },
      { id: insertReturns[2].id },
    ]);

    const readUsers = await mapper
      .select()
      .modify((qb) => qb.orderBy('id'))
      .getMany();
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
      ['*'],
      Selectable<Database['users']>,
      Insertable<Database['users']>,
      Partial<Insertable<Database['users']>>,
      ['id'],
      ReturnedUser
    > {
      constructor(db: Kysely<Database>) {
        super(db, 'users', {
          returnColumns: ['id'],
          updateReturnTransform: (source, returns) =>
            new ReturnedUser(
              returns.id,
              source.name ? source.name.split(' ')[0] : '(first)',
              source.name ? source.name.split(' ')[1] : '(last)',
              source.handle ? source.handle : '(handle)',
              source.email ? source.email : '(email)'
            ),
        });
      }
    }
    const updateReturnTransformMapper = new UpdateReturnTransformMapper(db);

    const insertReturn = await updateReturnTransformMapper
      .insert()
      .getReturns(userRow1);
    const updateReturn = await updateReturnTransformMapper
      .update({ id: insertReturn.id })
      .getReturns({ name: 'Suzanne Smith' });
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
      ['*'],
      Selectable<Database['users']>,
      Insertable<Database['users']>,
      UpdaterUser,
      ['id'],
      ReturnedUser
    > {
      constructor(db: Kysely<Database>) {
        super(db, 'users', {
          updaterTransform: (source) => ({
            name: `${source.firstName} ${source.lastName}`,
            handle: source.handle,
            email: source.email,
          }),
          returnColumns: ['id'],
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
    const updateAndReturnTransformMapper = new UpdateAndReturnTransformMapper(
      db
    );

    const insertReturn = await updateAndReturnTransformMapper
      .insert()
      .getReturns(userRow1);
    const updateReturn = await updateAndReturnTransformMapper
      .update({ id: insertReturn.id })
      .getReturns(UpdaterUser.create(0, userObject1));
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
