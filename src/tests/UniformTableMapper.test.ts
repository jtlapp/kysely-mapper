import { Kysely } from 'kysely';

import { createDB, resetDB, destroyDB } from './utils/test-setup';
import { Database, Users } from './utils/test-tables';
import { USERS, insertedUser1 } from './utils/test-objects';
import { TableObject, UniformTableMapper } from '../mappers/UniformTableMapper';

let db: Kysely<Database>;

beforeAll(async () => {
  db = await createDB();
});
beforeEach(() => resetDB(db));
afterAll(() => destroyDB(db));

it('inserts/updates/deletes a mapped object w/ default transforms', async () => {
  class KeyedUser implements TableObject<Users, ['id']> {
    constructor(
      public id: number,
      public name: string,
      public handle: string,
      public email: string
    ) {}

    getKey(): [number] {
      return [this.id];
    }
  }

  const userMapper = new UniformTableMapper<Database, 'users', KeyedUser>(
    db,
    'users',
    ['id']
  );

  // test updating a non-existent user
  const userWithID = new KeyedUser(
    1,
    USERS[0].name,
    USERS[0].handle,
    USERS[0].email
  );
  const updateReturn1 = await userMapper.update(userWithID);
  expect(updateReturn1).toEqual(null);

  // test inserting a user with falsy id
  const insertedUser1 = new KeyedUser(
    0,
    USERS[0].name,
    USERS[0].handle,
    USERS[0].email
  );
  const insertReturn1 = (await userMapper.insert().getReturns(insertedUser1))!;
  expect(insertReturn1).not.toBeNull();
  expect(insertReturn1.id).toBeGreaterThan(0);

  // test getting a user by ID
  const selectedUser1 = await userMapper.selectByKey(insertReturn1.id);
  expect(selectedUser1).toEqual(insertReturn1);
  expect(selectedUser1?.id).toEqual(insertReturn1.id);

  // test inserting a user with truthy id
  const insertedUser2 = new KeyedUser(
    10,
    USERS[1].name,
    USERS[1].handle,
    USERS[1].email
  );
  const insertReturn2 = (await userMapper.insert().getReturns(insertedUser2))!;
  expect(insertReturn2).toEqual(insertedUser2);
  const selectedUser2 = await userMapper.selectByKey(insertReturn2.id);
  expect(selectedUser2).toEqual(insertedUser2);

  // test updating a user, with returned object
  const updaterUser = new KeyedUser(
    selectedUser1!.id,
    'Xana',
    selectedUser1!.handle,
    selectedUser1!.email
  );
  const updateReturn = await userMapper.update(updaterUser);
  expect(updateReturn).toEqual(updaterUser);
  const selectedUser3 = await userMapper.selectByKey(insertReturn1.id);
  expect(selectedUser3).toEqual(updateReturn);

  // test updating a user, without returned object
  const updaterUser2 = new KeyedUser(
    selectedUser3!.id,
    'Freddy',
    selectedUser3!.handle,
    selectedUser3!.email
  );
  const updateReturn2 = await userMapper.updateNoReturns(updaterUser2);
  expect(updateReturn2).toBe(true);
  const selectedUser4 = await userMapper.selectByKey(insertReturn1.id);
  expect(selectedUser4).toEqual(updaterUser2);

  // test deleting a user
  const deleted = await userMapper.deleteByKey(insertReturn1.id);
  expect(deleted).toEqual(true);
  const selectedUser5 = await userMapper.selectByKey(insertReturn1.id);
  expect(selectedUser5).toBeNull();
});

it('inserts/updates/deletes a mapped object class w/ all custom transforms', async () => {
  class KeyedUser implements TableObject<Users, ['id']> {
    constructor(
      public serialNo: number,
      public firstName: string,
      public lastName: string,
      public handle: string,
      public email: string
    ) {}

    getKey(): [number] {
      return [this.serialNo];
    }
  }

  const userMapper = new UniformTableMapper(db, 'users', ['id'], {
    insertTransform: (user: KeyedUser) => {
      return {
        name: `${user.firstName} ${user.lastName}`,
        handle: user.handle,
        email: user.email,
      };
    },
    insertReturnTransform: (user, returns) => {
      return new KeyedUser(
        returns.id,
        user.firstName,
        user.lastName,
        user.handle,
        user.email
      );
    },
    updaterTransform: (user: KeyedUser) => {
      return {
        name: `${user.firstName} ${user.lastName}`,
        handle: user.handle + '2',
        email: user.email,
      };
    },
    updateReturnTransform: (user, _returns) => {
      return new KeyedUser(
        user.serialNo,
        user.firstName,
        user.lastName,
        user.handle,
        user.email
      );
    },
    selectTransform: (row) => {
      const names = row.name.split(' ');
      return new KeyedUser(row.id, names[0], names[1], row.handle, row.email);
    },
  });

  // test updating a non-existent user
  const updateReturn1 = await userMapper.update(
    new KeyedUser(
      1,
      insertedUser1.firstName,
      insertedUser1.lastName,
      insertedUser1.handle,
      insertedUser1.email
    )
  );
  expect(updateReturn1).toEqual(null);

  // test inserting a user
  const insertedUser = new KeyedUser(
    0,
    insertedUser1.firstName,
    insertedUser1.lastName,
    insertedUser1.handle,
    insertedUser1.email
  );
  const insertReturn = (await userMapper.insert().getReturns(insertedUser))!;
  expect(insertReturn).not.toBeNull();
  expect(insertReturn.serialNo).toBeGreaterThan(0);

  // test getting a user by ID
  const selectedUser1 = await userMapper.selectByKey(insertReturn.serialNo);
  expect(selectedUser1).toEqual(insertReturn);
  expect(selectedUser1?.serialNo).toEqual(insertReturn.serialNo);

  // test updating a user, with returned object
  const updaterUser = new KeyedUser(
    selectedUser1!.serialNo,
    selectedUser1!.firstName,
    'Xana',
    selectedUser1!.handle,
    selectedUser1!.email
  );
  const updateReturn = await userMapper.update(updaterUser);
  expect(updateReturn).toEqual(updaterUser);
  const selectedUser2 = await userMapper.selectByKey(insertReturn.serialNo);
  expect(selectedUser2?.serialNo).toEqual(selectedUser1!.serialNo);
  expect(selectedUser2?.handle).toEqual(selectedUser1!.handle + '2');

  // test updating a column with returns
  const updateColumnReturns = await userMapper.updateWhere(
    ['id', '=', insertReturn.serialNo],
    {
      name: 'Foo Foo',
    }
  );
  expect(updateColumnReturns).toEqual([{ id: selectedUser1!.serialNo }]);
  const selectedUser4 = await userMapper.selectByKey(insertReturn.serialNo);
  expect(selectedUser4?.firstName).toEqual('Foo');

  // test deleting a user
  const deleted = await userMapper.deleteByKey(insertReturn.serialNo);
  expect(deleted).toEqual(true);
  const selectedUser3 = await userMapper.selectByKey(insertReturn.serialNo);
  expect(selectedUser3).toBeNull();
});

it('inserts/updates/deletes a mapped object class w/ inferred update transforms', async () => {
  class KeyedUser implements TableObject<Users, ['id']> {
    constructor(
      public id: number,
      public firstName: string,
      public lastName: string,
      public handle: string,
      public email: string
    ) {}

    getKey(): [number] {
      return [this.id];
    }
  }

  const userMapper = new UniformTableMapper(db, 'users', ['id'], {
    insertTransform: (user: KeyedUser) => {
      return {
        name: `${user.firstName} ${user.lastName}`,
        handle: user.handle,
        email: user.email,
      };
    },
    updaterTransform: (user: KeyedUser) => {
      return {
        name: `${user.firstName} ${user.lastName}`,
        handle: user.handle,
        email: user.email,
      };
    },
    insertReturnTransform: (user, returns) => {
      return new KeyedUser(
        returns.id,
        user.firstName,
        user.lastName,
        user.handle,
        user.email
      );
    },
    selectTransform: (row) => {
      const names = row.name.split(' ');
      return new KeyedUser(row.id, names[0], names[1], row.handle, row.email);
    },
  });

  // test updating a non-existent user
  const updateReturn1 = await userMapper.update(
    new KeyedUser(
      1,
      insertedUser1.firstName,
      insertedUser1.lastName,
      insertedUser1.handle,
      insertedUser1.email
    )
  );
  expect(updateReturn1).toEqual(null);

  // test inserting a user
  const insertedUser = new KeyedUser(
    0,
    insertedUser1.firstName,
    insertedUser1.lastName,
    insertedUser1.handle,
    insertedUser1.email
  );
  const insertReturn = (await userMapper.insert().getReturns(insertedUser))!;
  expect(insertReturn).not.toBeNull();
  expect(insertReturn.id).toBeGreaterThan(0);

  // test getting a user by ID
  const selectedUser1 = await userMapper.selectByKey(insertReturn.id);
  expect(selectedUser1).toEqual(insertReturn);
  expect(selectedUser1?.id).toEqual(insertReturn.id);

  // test updating a user
  const updaterUser = new KeyedUser(
    selectedUser1!.id,
    selectedUser1!.firstName,
    'Xana',
    selectedUser1!.handle,
    selectedUser1!.email
  );
  const updateReturn = await userMapper.update(updaterUser);
  expect(updateReturn).toEqual(updaterUser);
  const selectedUser2 = await userMapper.selectByKey(insertReturn.id);
  expect(selectedUser2).toEqual(updateReturn);

  // test updating a user, without returned object
  const updaterUser2 = new KeyedUser(
    selectedUser2!.id,
    'Super',
    'Man',
    selectedUser2!.handle,
    selectedUser2!.email
  );
  const updateReturn2 = await userMapper.updateNoReturns(updaterUser2);
  expect(updateReturn2).toBe(true);
  const selectedUser3 = await userMapper.selectByKey(insertReturn.id);
  expect(selectedUser3).toEqual(updaterUser2);

  // test deleting a user
  const deleted = await userMapper.deleteByKey(insertReturn.id);
  expect(deleted).toEqual(true);
  const selectedUser4 = await userMapper.selectByKey(insertReturn.id);
  expect(selectedUser4).toBeNull();
});
