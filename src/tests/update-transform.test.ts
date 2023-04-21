import { Kysely, Updateable } from 'kysely';

import { TableMapper } from '../mappers/table-mapper';
import { createDB, resetDB, destroyDB } from './utils/test-setup';
import { Database, Users } from './utils/test-tables';
import {
  userObject1,
  userRow1,
  userRow2,
  userRow3,
} from './utils/test-objects';
import { ReturnedUser, UpdatingUser } from './utils/test-types';

let db: Kysely<Database>;

beforeAll(async () => {
  db = await createDB();
});
beforeEach(() => resetDB(db));
afterAll(() => destroyDB(db));

describe('updating with transformation', () => {
  it('transforms users for update without transforming return', async () => {
    const mapper = new TableMapper(db, 'users', {
      insertReturnColumns: ['id'],
      updateReturnColumns: ['id'],
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
      insertReturnColumns: ['id'],
      updateReturnColumns: ['id'],
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
      insertReturnColumns: ['id'],
      updateReturnColumns: ['id'],
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
      insertReturnColumns: ['id'],
      updateReturnColumns: ['id'],
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

  it('transforms a union of updating object types', async () => {
    const mapper = new TableMapper(db, 'users', {
      keyColumns: ['id'],
    }).withTransforms({
      updateTransform: (source: UpdatingUser | Updateable<Users>) =>
        source instanceof UpdatingUser
          ? {
              name: `${source.firstName} ${source.lastName}`,
              handle: source.handle,
              email: source.email,
            }
          : source,
    });
    const insertReturn = await mapper.insert().returnOne(userRow1);

    // test with UpdatingUser
    await mapper
      .update({ id: insertReturn.id })
      .columns(['name'])
      .run(UpdatingUser.create(0, userObject1));
    const readUser1 = await mapper.select(insertReturn.id).returnOne();
    expect(readUser1).toEqual({
      id: insertReturn.id,
      name: `${userObject1.firstName} ${userObject1.lastName}`,
      email: userRow1.email,
      handle: userRow1.handle,
    });

    // test with Updateable<Users>
    const newName = 'Suzanne Smith Something';
    await mapper.update({ id: insertReturn.id }).run({ name: newName });
    const readUser2 = await mapper.select(insertReturn.id).returnOne();
    expect(readUser2).toEqual({
      id: insertReturn.id,
      name: newName,
      email: userRow1.email,
      handle: userRow1.handle,
    });
  });
});
