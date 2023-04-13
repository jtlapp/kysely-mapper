import { Kysely } from 'kysely';

import { createDB, resetDB, destroyDB } from './utils/test-setup';
import { Database } from './utils/test-tables';
import {
  USERS,
  STANDARD_OPTIONS,
  insertedUser1,
  selectedUser1,
} from './utils/test-objects';
import { KeyedTableMapper } from '../mappers/KeyedTableMapper';
import { ReturnedUser, SelectedUser, UpdaterUser } from './utils/test-types';
import { ignore } from './utils/test-utils';

class ExplicitKeyedMapper extends KeyedTableMapper<Database, 'users', ['id']> {
  constructor(readonly db: Kysely<Database>) {
    super(db, 'users', ['id'], { returnColumns: ['id'] });
  }
}

let db: Kysely<Database>;
let explicitKeyedMapper: ExplicitKeyedMapper;

beforeAll(async () => {
  db = await createDB();
  explicitKeyedMapper = new ExplicitKeyedMapper(db);
});
beforeEach(() => resetDB(db));
afterAll(() => destroyDB(db));

describe('keyed table mapper using a single-column tuple key', () => {
  ignore('requires return columns to include the key column', () => {
    new KeyedTableMapper<Database, 'users', ['id']>(db, 'users', ['id'], {
      // @ts-expect-error - actual and declared return types must match
      returnColumns: ['name'],
    });
    new KeyedTableMapper<Database, 'users', ['id']>(db, 'users', ['id'], {
      // @ts-expect-error - actual and declared return types must match
      returnColumns: ['id', 'name'],
    });
  });

  it('selects, updates, and deletes nothing when no rows match', async () => {
    const readUser = await explicitKeyedMapper.selectByKey([1]);
    expect(readUser).toBeNull();

    const updated = await explicitKeyedMapper.updateByKeyNoReturns([1], {
      email: 'new@baz.com',
    });
    expect(updated).toEqual(false);

    const deleted = await explicitKeyedMapper.deleteByKey([1]);
    expect(deleted).toEqual(false);
  });

  it('inserts, selects, updates, and deletes objects by key', async () => {
    // Add users
    const id0 = (await explicitKeyedMapper.insert().getOne(USERS[0])).id;
    const id1 = (await explicitKeyedMapper.insert().getOne(USERS[1])).id;

    // Update a user without returning columns
    const NEW_EMAIL = 'new@baz.com';
    const updated = await explicitKeyedMapper.updateByKeyNoReturns([id1], {
      email: NEW_EMAIL,
    });
    expect(updated).toEqual(true);

    // Retrieves a user by key
    const readUser1 = await explicitKeyedMapper.selectByKey([id1]);
    expect(readUser1?.handle).toEqual(USERS[1].handle);
    expect(readUser1?.email).toEqual(NEW_EMAIL);

    // Delete a user
    const deleted = await explicitKeyedMapper.deleteByKey([id1]);
    expect(deleted).toEqual(true);

    // Verify correct user was deleted
    const readUser0 = await explicitKeyedMapper.selectByKey([id0]);
    expect(readUser0?.handle).toEqual(USERS[0].handle);
    const noUser = await explicitKeyedMapper.selectByKey([id1]);
    expect(noUser).toBeNull();
  });

  it('updates returning default key by default with default key', async () => {
    const defaultKeyMapper = new KeyedTableMapper(db, 'users');
    const id1 = (await defaultKeyMapper.insert().getOne(USERS[1])).id;

    const NEW_EMAIL1 = 'new1@baz.com';
    const updated1 = await defaultKeyMapper.updateByKey([id1], {
      email: NEW_EMAIL1,
    });
    expect(updated1).toEqual({ id: id1 });

    const readUser1 = await defaultKeyMapper.selectByKey([id1]);
    expect(readUser1?.email).toEqual(NEW_EMAIL1);

    // Test with const key, which TypeScript treats as a tuple.
    const key = [id1] as const;
    const NEW_EMAIL2 = 'new2@baz.com';
    const updated2 = await defaultKeyMapper.updateByKey(key, {
      email: NEW_EMAIL2,
    });
    expect(updated2).toEqual({ id: id1 });

    const readUser2 = await defaultKeyMapper.selectByKey(key);
    expect(readUser2?.email).toEqual(NEW_EMAIL2);
  });

  it('updates returning key by default with specified key', async () => {
    // Make sure KeyedTableMapper will take readonly key columns.
    const keyColumns = ['id'] as const;
    const defaultKeyMapper = new KeyedTableMapper(db, 'users', keyColumns);
    const id1 = (await defaultKeyMapper.insert().getOne(USERS[1])).id;

    const NEW_EMAIL1 = 'new1@baz.com';
    const updated1 = await defaultKeyMapper.updateByKey([id1], {
      email: NEW_EMAIL1,
    });
    expect(updated1).toEqual({ id: id1 });

    const readUser1 = await defaultKeyMapper.selectByKey([id1]);
    expect(readUser1?.email).toEqual(NEW_EMAIL1);

    // Test with const key, which TypeScript treats as a tuple.
    const key = [id1] as const;
    const NEW_EMAIL2 = 'new2@baz.com';
    const updated2 = await defaultKeyMapper.updateByKey(key, {
      email: NEW_EMAIL2,
    });
    expect(updated2).toEqual({ id: id1 });

    const readUser2 = await defaultKeyMapper.selectByKey(key);
    expect(readUser2?.email).toEqual(NEW_EMAIL2);
  });

  it('updates returning expected columns', async () => {
    const id1 = (await explicitKeyedMapper.insert().getOne(USERS[1])).id;

    const NEW_EMAIL = 'new@baz.com';
    const updated = await explicitKeyedMapper.updateByKey([id1], {
      email: NEW_EMAIL,
    });
    // prettier-ignore
    expect(updated).toEqual({ id: id1 });
  });

  it("provides a default key of 'id'", async () => {
    const defaultIdMapper = new KeyedTableMapper(db, 'users');

    await defaultIdMapper.insert().run(USERS[0]);
    const id1 = (await defaultIdMapper.insert().getOne(USERS[1])).id;

    const readUser1 = await explicitKeyedMapper.selectByKey([id1]);
    expect(readUser1?.handle).toEqual(USERS[1].handle);
  });

  it('allows for returning other columns with the key', async () => {
    const idAndHandleMapper = new KeyedTableMapper(db, 'users', ['id'], {
      returnColumns: ['id', 'handle'],
    });

    const insertReturn1 = await idAndHandleMapper.insert().getOne(USERS[0]);
    expect(insertReturn1).toEqual({
      id: 1,
      handle: USERS[0].handle,
    });

    const insertReturn2 = await idAndHandleMapper.insert().getOne(USERS[1]);
    expect(insertReturn2).toEqual({
      id: 2,
      handle: USERS[1].handle,
    });
  });

  it('allows for returning all columns', async () => {
    const allColumnsMapper = new KeyedTableMapper(db, 'users', ['id'], {
      returnColumns: ['*'],
    });

    const insertReturn1 = await allColumnsMapper.insert().getOne(USERS[0]);
    expect(insertReturn1).toEqual({
      id: 1,
      handle: USERS[0].handle,
      name: USERS[0].name,
      email: USERS[0].email,
    });

    const insertReturn2 = await allColumnsMapper.insert().getOne(USERS[1]);
    expect(insertReturn2).toEqual({
      id: 2,
      handle: USERS[1].handle,
      name: USERS[1].name,
      email: USERS[1].email,
    });
  });

  it('transforms inputs and outputs', async () => {
    const testTransformMapper = new KeyedTableMapper(
      db,
      'users',
      ['id'],
      STANDARD_OPTIONS
    );

    const insertReturn1 = await testTransformMapper
      .insert()
      .getOne(insertedUser1);
    expect(insertReturn1).toEqual(ReturnedUser.create(1, insertedUser1));

    const readUser1 = await testTransformMapper.selectByKey([1]);
    expect(readUser1).toEqual(selectedUser1);

    const updaterUser = new UpdaterUser(
      1,
      'Jimmy',
      'James',
      'jjames',
      'jjames@abc.def'
    );
    const updated = await testTransformMapper.updateByKeyNoReturns(
      [updaterUser.id],
      updaterUser
    );
    expect(updated).toEqual(true);

    const readUser2 = await testTransformMapper.selectByKey([1]);
    expect(readUser2).toEqual(SelectedUser.create(1, updaterUser));

    const deleted = await testTransformMapper.deleteByKey([1]);
    expect(deleted).toEqual(true);

    const readUser3 = await testTransformMapper.selectByKey([1]);
    expect(readUser3).toBeNull();
  });

  it('returns nothing when there are no return columns', async () => {
    const noReturnMapper = new KeyedTableMapper(db, 'users', ['id'], {
      returnColumns: [],
    });

    const insertReturn1 = await noReturnMapper.insert().getOne(USERS[0]);
    expect(insertReturn1).toBeUndefined();

    const update1 = await noReturnMapper.updateByKey([1], {
      name: 'Jeff Jack',
    });
    expect(update1).toBeUndefined();

    const update2 = await noReturnMapper.updateByKeyNoReturns([1], {
      name: 'Jack Jeffrey',
    });
    expect(update2).toBe(true);
  });
});

describe('keyed table mapper using a single-column value key', () => {
  it('inserts, selects, updates, and deletes objects by value key', async () => {
    // Add users
    const id0 = (await explicitKeyedMapper.insert().getOne(USERS[0])).id;
    const id1 = (await explicitKeyedMapper.insert().getOne(USERS[1])).id;

    // Update a user without returning columns
    const NEW_EMAIL1 = 'new1@baz.com';
    const updated1 = await explicitKeyedMapper.updateByKeyNoReturns(id1, {
      email: NEW_EMAIL1,
    });
    expect(updated1).toEqual(true);

    // Retrieves a user by key
    const readUser1 = await explicitKeyedMapper.selectByKey(id1);
    expect(readUser1?.handle).toEqual(USERS[1].handle);
    expect(readUser1?.email).toEqual(NEW_EMAIL1);

    // Update a user returning columns
    const NEW_EMAIL2 = 'new2w@baz.com';
    const updated2 = await explicitKeyedMapper.updateByKey(id1, {
      email: NEW_EMAIL2,
    });
    expect(updated2).toEqual({ id: id1 });

    // Retrieves updated user by key
    const readUser2 = await explicitKeyedMapper.selectByKey(id1);
    expect(readUser2?.handle).toEqual(USERS[1].handle);
    expect(readUser2?.email).toEqual(NEW_EMAIL2);

    // Delete a user
    const deleted = await explicitKeyedMapper.deleteByKey(id1);
    expect(deleted).toEqual(true);

    // Verify correct user was deleted
    const readUser0 = await explicitKeyedMapper.selectByKey(id0);
    expect(readUser0?.handle).toEqual(USERS[0].handle);
    const noUser = await explicitKeyedMapper.selectByKey(id1);
    expect(noUser).toBeNull();
  });
});

describe('keyed table mapper using a multi-column tuple key', () => {
  it('inserts, selects, updates, and deletes objects by tuple key', async () => {
    const multiKeyMapper = new KeyedTableMapper(
      db,
      'users',
      ['name', 'handle'],
      {
        returnColumns: ['id'],
      }
    );

    // Add users
    const id0 = (
      await multiKeyMapper.insert().getOne({
        name: 'Jon',
        handle: 'jon',
        email: 'jon@abc.def',
      })
    ).id;
    const id1 = (
      await multiKeyMapper.insert().getOne({
        name: 'Jon',
        handle: 'jonny',
        email: 'jonny@abc.def',
      })
    ).id;
    await multiKeyMapper.insert().run({
      name: 'John',
      handle: 'jonny',
      email: 'john@abc.def',
    });

    // Update a user without returning columns
    const NEW_EMAIL1 = 'johnny1@abc.def';
    const updated1 = await multiKeyMapper.updateByKeyNoReturns(
      ['Jon', 'jonny'],
      {
        email: NEW_EMAIL1,
      }
    );
    expect(updated1).toEqual(true);

    // Retrieves a user by key
    const readUser1 = await multiKeyMapper.selectByKey(['Jon', 'jonny']);
    expect(readUser1?.id).toEqual(id1);
    expect(readUser1?.email).toEqual(NEW_EMAIL1);

    // Update a user returning columns
    const NEW_EMAIL2 = 'johnny2@abc.def';
    const updated2 = await multiKeyMapper.updateByKey(['Jon', 'jonny'], {
      email: NEW_EMAIL2,
    });
    expect(updated2).toEqual({ id: id1 });

    // Retrieves updated user by key
    const readUser2 = await multiKeyMapper.selectByKey(['Jon', 'jonny']);
    expect(readUser2?.id).toEqual(id1);
    expect(readUser2?.email).toEqual(NEW_EMAIL2);
    const readUser2b = await multiKeyMapper.selectByKey(['Jon', 'jon']);
    expect(readUser2b?.id).toEqual(id0);

    // Delete a user
    const deleted = await multiKeyMapper.deleteByKey(['Jon', 'jonny']);
    expect(deleted).toEqual(true);

    // Verify correct user was deleted
    const readUser3 = await multiKeyMapper.selectByKey(['Jon', 'jonny']);
    expect(readUser3).toBeNull();
    const readUser3b = await multiKeyMapper.selectByKey(['Jon', 'jon']);
    expect(readUser3b?.id).toEqual(id0);
  });
});

ignore('keyed table mapper type errors', () => {
  const strStrKeyMapper = new KeyedTableMapper(
    db,
    'users',
    ['name', 'handle'],
    {
      returnColumns: ['id'],
    }
  );
  const idStrKeyMapper = new KeyedTableMapper(db, 'users', ['id', 'handle'], {
    returnColumns: ['id'],
  });

  // @ts-expect-error - key tuple element types must match column types
  new KeyedTableMapper(db, 'users', ['id']).selectByKey('str');
  // @ts-expect-error - key tuple element types must match column types
  new KeyedTableMapper(db, 'users', ['id']).selectByKey(['str']);
  // @ts-expect-error - key tuple element types must match column types
  strStrKeyMapper.selectByKey(['str', 1]);
  // @ts-expect-error - key tuple element types must match column types
  idStrKeyMapper.selectByKey(['str', 1]);
  // @ts-expect-error - key tuple element types must have correct size
  new KeyedTableMapper(db, 'users', ['id']).selectByKey([1, 2]);
  // @ts-expect-error - key tuple element types must have correct size
  new KeyedTableMapper(db, 'users', ['id']).selectByKey([1, 'str']);
  // @ts-expect-error - key tuple element types must have correct size
  strStrKeyMapper.selectByKey(['str']);
  // @ts-expect-error - key tuple element types must have correct size
  strStrKeyMapper.selectByKey(['str', 'str', 'str']);
  // @ts-expect-error - key tuple element types must have correct size
  idStrKeyMapper.selectByKey([1]);
});
