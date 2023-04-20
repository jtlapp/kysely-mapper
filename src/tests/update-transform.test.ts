import { Kysely } from 'kysely';

import { TableMapper } from '../mappers/table-mapper';
import { createDB, resetDB, destroyDB } from './utils/test-setup';
import { Database } from './utils/test-tables';
import { createVariableReturnTypeMapper } from './utils/test-mappers';
import {
  userObject1,
  userRow1,
  userRow2,
  userRow3,
} from './utils/test-objects';
import { ignore } from './utils/test-utils';
import { ReturnedUser, SelectedUser, UpdatingUser } from './utils/test-types';

let db: Kysely<Database>;

beforeAll(async () => {
  db = await createDB();
});
beforeEach(() => resetDB(db));
afterAll(() => destroyDB(db));

describe('updating with transformation', () => {
  it('transforms users for update without transforming return', async () => {
    const mapper = new TableMapper(db, 'users', {
      returnColumns: ['id'],
    }).withTransforms({
      updateTransform: (source: UpdatingUser) => ({
        name: `${source.firstName} ${source.lastName}`,
        handle: source.handle,
        email: source.email,
      }),
    });

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

  it('transforms update return into object without transforming update', async () => {
    const updateReturnTransformMapper = new TableMapper(db, 'users', {
      returnColumns: ['id'],
    }).withTransforms({
      updateReturnTransform: (source, returns) =>
        new ReturnedUser(
          returns.id,
          source.name ? source.name.split(' ')[0] : '(first)',
          source.name ? source.name.split(' ')[1] : '(last)',
          source.handle ? source.handle : '(handle)',
          source.email ? source.email : '(email)'
        ),
    });

    const insertReturn = await updateReturnTransformMapper
      .insert()
      .returnOne(userRow1);

    const updateReturn1 = await updateReturnTransformMapper
      .update({ id: insertReturn.id })
      .returnAll({ name: 'Suzanne Smith' });
    expect(updateReturn1).toEqual([
      new ReturnedUser(
        insertReturn.id,
        'Suzanne',
        'Smith',
        '(handle)',
        '(email)'
      ),
    ]);
    // Ensure the returned value is accessible as a ReturnedUser
    ((_: string) => {})(updateReturn1[0].firstName);

    const updateReturn2 = await updateReturnTransformMapper
      .update({ id: insertReturn.id })
      .returnOne({ name: 'Suzanne Smithy' });
    expect(updateReturn2).toEqual(
      new ReturnedUser(
        insertReturn.id,
        'Suzanne',
        'Smithy',
        '(handle)',
        '(email)'
      )
    );
    // Ensure the returned value is accessible as a ReturnedUser
    ((_: string) => {})(updateReturn2!.firstName);
  });

  it('transforms update return into primitive without transforming update', async () => {
    const updateReturnTransformMapper = new TableMapper(db, 'users', {
      returnColumns: ['id'],
    }).withTransforms({
      insertReturnTransform: (_source, returns) => returns.id,
      updateReturnTransform: (_source, returns) => returns.id,
    });

    const insertReturn = await updateReturnTransformMapper
      .insert()
      .returnOne(userRow1);

    const updateReturn1 = await updateReturnTransformMapper
      .update({ id: insertReturn })
      .returnAll({ name: 'Suzanne Smith' });
    expect(updateReturn1).toEqual([1]);
    // Ensure the returned value is accessible as a number
    ((_: number) => {})(updateReturn1[0]);

    const updateReturn2 = await updateReturnTransformMapper
      .update({ id: insertReturn })
      .returnOne({ name: 'Suzanne Smithy' });
    expect(updateReturn2).toEqual(1);
    // Ensure the returned value is accessible as a number
    ((_: number) => {})(updateReturn2!);
  });

  it('transforms update and update return', async () => {
    const updateAndReturnTransformMapper = new TableMapper(db, 'users', {
      returnColumns: ['id'],
    }).withTransforms({
      updateTransform: (source: UpdatingUser) => ({
        name: `${source.firstName} ${source.lastName}`,
        handle: source.handle,
        email: source.email,
      }),
      updateReturnTransform: (source: UpdatingUser, returns) =>
        new ReturnedUser(
          returns.id,
          source.firstName,
          source.lastName,
          source.handle,
          source.email
        ),
    });

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
    // Ensure the returned value is accessible as a ReturnedUser
    ((_: string) => {})(updateReturn[0].firstName);
  });

  it('variably transforms update and update return for returnOne()', async () => {
    const updateAndReturnTransformMapper = createVariableReturnTypeMapper(db);

    const insertReturns = await updateAndReturnTransformMapper
      .insert()
      .returnAll([userRow1, userRow2]);

    // test that updating with an UpdatingUser returns a SelectedUser
    const updatingUser1 = new SelectedUser(
      0,
      'Ralph',
      'Mac',
      'ralph',
      'ralph@abc.def'
    );
    const updateReturn1 = await updateAndReturnTransformMapper
      .update({ id: insertReturns[0].id })
      .returnOne(updatingUser1);
    expect(updateReturn1).toEqual(
      SelectedUser.create(insertReturns[0].id, updatingUser1)
    );
    // Ensure the returned value is accessible as a SelectedUser
    ((_: string) => {})(updateReturn1!.firstName);

    const readUser1 = await updateAndReturnTransformMapper
      .select({ id: insertReturns[0].id })
      .returnOne();
    expect(readUser1).toEqual(updateReturn1);

    // test that updating with a plain object returns a plain object
    const newName = 'Geofrey Mac';
    const updateReturn2 = await updateAndReturnTransformMapper
      .update({ id: insertReturns[1].id })
      .returnOne({ name: newName });
    expect(updateReturn2).toEqual({
      id: insertReturns[1].id,
      handle: userRow2.handle,
    });
    // Ensure the returned value is accessible as raw columns
    ((_: string) => {})(updateReturn2!.handle);

    const readUser2 = await updateAndReturnTransformMapper
      .select({ id: insertReturns[1].id })
      .returnOne();
    const names2 = newName.split(' ');
    expect(readUser2).toEqual(
      SelectedUser.create(insertReturns[1].id, {
        firstName: names2[0],
        lastName: names2[1],
        handle: userRow2.handle,
        email: userRow2.email,
      })
    );

    ignore('check types', () => {
      // @ts-expect-error - verify SelectedUser return
      ((_: string) => {})(updateReturn1!.name);
      // @ts-expect-error - verify plain object return
      ((_: string) => {})(updateReturn2!.firstName);
    });
  });

  it('variably transforms update and update return for returnAll()', async () => {
    const updateAndReturnTransformMapper = createVariableReturnTypeMapper(db);

    const insertReturns = await updateAndReturnTransformMapper
      .insert()
      .returnAll([userRow1, userRow2]);

    // test that updating with an UpdatingUser returns a SelectedUser
    const updatingUser1 = new SelectedUser(
      0,
      'Ralph',
      'Mac',
      'ralph',
      'ralph@abc.def'
    );
    const updateReturns1 = await updateAndReturnTransformMapper
      .update({ id: insertReturns[0].id })
      .returnAll(updatingUser1);
    expect(updateReturns1).toEqual([
      SelectedUser.create(insertReturns[0].id, updatingUser1),
    ]);
    // Ensure the returned value is accessible as a SelectedUser
    ((_: string) => {})(updateReturns1[0].firstName);

    const readUser = await updateAndReturnTransformMapper
      .select({ id: insertReturns[0].id })
      .returnOne();
    expect(readUser).toEqual(updateReturns1[0]);

    // test that updating with a plain object returns a plain object
    const newName = 'Geofrey Mac';
    const updateReturns2 = await updateAndReturnTransformMapper
      .update({ id: insertReturns[1].id })
      .returnAll({ name: newName });
    expect(updateReturns2).toEqual([
      { id: insertReturns[1].id, handle: userRow2.handle },
    ]);
    // Ensure the returned value is accessible as raw columns
    ((_: string) => {})(updateReturns2[0].handle);

    const readUser2 = await updateAndReturnTransformMapper
      .select({ id: insertReturns[1].id })
      .returnOne();
    const names2 = newName.split(' ');
    expect(readUser2).toEqual(
      SelectedUser.create(insertReturns[1].id, {
        firstName: names2[0],
        lastName: names2[1],
        handle: userRow2.handle,
        email: userRow2.email,
      })
    );

    ignore('check types', () => {
      // @ts-expect-error - verify SelectedUser return
      ((_: string) => {})(updateReturns1[0].name);
      // @ts-expect-error - verify plain object return
      ((_: string) => {})(updateReturns2[0].firstName);
    });
  });
});
