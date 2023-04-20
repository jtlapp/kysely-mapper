import { Kysely, Updateable } from 'kysely';

import { TableMapper } from '../mappers/table-mapper';
import { createDB, resetDB, destroyDB } from './utils/test-setup';
import { Database } from './utils/test-tables';
import { createInsertTransformMapper } from './utils/test-mappers';
import {
  userRow1,
  userRow2,
  userRow3,
  insertedUser1,
  insertedUser2,
  insertedUser3,
  insertReturnedUser1,
  insertReturnedUser2,
  insertReturnedUser3,
} from './utils/test-objects';
import { InsertedUser, ReturnedUser, SelectedUser } from './utils/test-types';

let db: Kysely<Database>;

beforeAll(async () => {
  db = await createDB();
});
beforeEach(() => resetDB(db));
afterAll(() => destroyDB(db));

describe('inserting with transformation', () => {
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

  it('transforms insertion return into object without transforming insertion', async () => {
    const insertReturnTransformMapper = new TableMapper(db, 'users', {
      insertReturnColumns: ['id', 'name'],
      updateReturnColumns: ['id', 'name'],
    }).withTransforms({
      insertReturnTransform: (source, returns) => {
        const names = returns.name.split(' ');
        return new ReturnedUser(
          returns.id,
          names[0],
          names[1],
          source.handle,
          source.email || null
        );
      },
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

    // test that updates return table rows
    const updatedUser = await insertReturnTransformMapper
      .update({ id: insertReturn.id })
      .returnOne({ name: 'Updated Name' });
    expect(updatedUser).toEqual({ id: insertReturn.id, name: 'Updated Name' });
    // ensure return type can be accessed as a row
    ((_: string) => {})(updatedUser!.name);
  });

  it('transforms insertion return into primitive without transforming insertion', async () => {
    const insertReturnTransformMapper = new TableMapper(db, 'users', {
      insertReturnColumns: ['id'],
    }).withTransforms({
      insertReturnTransform: (_source, returns) => returns.id,
      countTransform: (count) => Number(count),
    });

    const insertReturn = await insertReturnTransformMapper
      .insert()
      .returnOne(userRow1);
    expect(insertReturn).toEqual(1);
    // ensure return type can be accessed as a number
    ((_: number) => {})(insertReturn);

    const insertReturns = await insertReturnTransformMapper
      .insert()
      .returnAll([userRow2, userRow3]);
    expect(insertReturns).toEqual([2, 3]);
    // ensure return type can be accessed as a number
    ((_: number) => {})(insertReturns[0]);
  });

  it('transforms insertion and insertion return', async () => {
    const insertAndReturnTransformMapper = new TableMapper(db, 'users', {
      insertReturnColumns: ['id'],
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
    // ensure return type can be accessed as a ReturnedUser
    ((_: string) => {})(insertReturn.firstName);

    const insertReturns = await insertAndReturnTransformMapper
      .insert()
      .returnAll([insertedUser2, insertedUser3]);
    expect(insertReturns).toEqual([insertReturnedUser2, insertReturnedUser3]);
    // ensure return type can be accessed as a ReturnedUser
    ((_: string) => {})(insertReturns[0].firstName);
  });

  it('returns SelectedObject with updates returning rows', async () => {
    const transformMapper = new TableMapper(db, 'users', {
      insertReturnColumns: ['id', 'name'],
      updateReturnColumns: ['id', 'name'],
    }).withTransforms({
      insertReturnTransform: (source, results) => {
        const names = results.name.split(' ');
        return SelectedUser.create(results.id, {
          firstName: names[0],
          lastName: names[1],
          handle: source.handle,
          email: source.email || null,
        });
      },
      updateTransform: (
        source: SelectedUser | Updateable<Database['users']>
      ) => {
        if (source instanceof SelectedUser) {
          return {
            name: `${source.firstName} ${source.lastName}`,
            handle: source.handle,
            email: source.email,
          };
        }
        return source;
      },
      selectTransform: (row) => {
        const names = row.name.split(' ');
        return SelectedUser.create(row.id, {
          firstName: names[0],
          lastName: names[1],
          handle: row.handle,
          email: row.email,
        });
      },
    });

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

    // test that updates return rows
    const updateReturn = await transformMapper
      .update({ id: 1 })
      .returnOne(expectedUser2);
    expect(updateReturn).toEqual({
      id: 1,
      name: `${expectedUser2.firstName} ${expectedUser2.lastName}`,
    });
    // ensure return type can be accessed as a row
    ((_: string) => {})(updateReturn!.name);
  });
});
