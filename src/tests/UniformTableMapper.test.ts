import { Kysely } from 'kysely';

import { createDB, resetDB, destroyDB } from './utils/test-setup';
import { Database } from './utils/test-tables';
import { USERS, insertedUser1 } from './utils/test-objects';
import { UniformTableMapper } from '../mappers/uniform-table-mapper';

let db: Kysely<Database>;

beforeAll(async () => {
  db = await createDB();
});
beforeEach(() => resetDB(db));
afterAll(() => destroyDB(db));

it('inserts/updates/deletes a mapped object w/ default transforms', async () => {
  class MappedUser {
    constructor(
      public id: number,
      public name: string,
      public handle: string,
      public email: string
    ) {}
  }

  const userMapper = new UniformTableMapper<Database, 'users', MappedUser>(
    db,
    'users',
    { isMappedObject: (obj) => obj instanceof MappedUser }
  );

  // test updating a non-existent user
  const userWithID = new MappedUser(
    1,
    USERS[0].name,
    USERS[0].handle,
    USERS[0].email
  );
  const updateReturn1 = await userMapper.update({ id: 1 }).getOne(userWithID);
  expect(updateReturn1).toEqual(null);

  // test inserting a user with falsy id
  const insertedUser1 = new MappedUser(
    0,
    USERS[0].name,
    USERS[0].handle,
    USERS[0].email
  );
  const insertReturn1 = (await userMapper.insert().getOne(insertedUser1))!;
  expect(insertReturn1).not.toBeNull();
  expect(insertReturn1.id).toBeGreaterThan(0);

  // test getting a user by ID
  const selectedUser1 = await userMapper
    .select({ id: insertReturn1.id })
    .getOne();
  expect(selectedUser1).toEqual({ ...insertedUser1, id: insertReturn1.id });
  // ensure 'id' is accessible
  expect(selectedUser1?.id).toEqual(insertReturn1.id);

  // test inserting a user with truthy id
  const insertedUser2 = new MappedUser(
    10,
    USERS[1].name,
    USERS[1].handle,
    USERS[1].email
  );
  const insertReturn2 = (await userMapper.insert().getOne(insertedUser2))!;
  expect(insertReturn2).toEqual({ id: 10 });
  const selectedUser2 = await userMapper
    .select({ id: insertReturn2.id })
    .getOne();
  expect(selectedUser2).toEqual(insertedUser2);

  // test updating a user, with returned object
  const updatingUser = new MappedUser(
    selectedUser1!.id,
    'Xana',
    selectedUser1!.handle,
    selectedUser1!.email
  );
  const updateReturn = await userMapper
    .update({ id: updatingUser.id })
    .getOne(updatingUser);
  expect(updateReturn).toEqual({ id: updatingUser.id });
  const selectedUser3 = await userMapper
    .select({ id: insertReturn1.id })
    .getOne();
  expect(selectedUser3).toEqual(updatingUser);

  // test updating a user, without returned object
  const updatingUser2 = new MappedUser(
    selectedUser3!.id,
    'Freddy',
    selectedUser3!.handle,
    selectedUser3!.email
  );
  const updateReturn2 = await userMapper
    .update({ id: updatingUser2.id })
    .run(updatingUser2);
  expect(updateReturn2).toBe(true);
  const selectedUser4 = await userMapper
    .select({ id: insertReturn1.id })
    .getOne();
  expect(selectedUser4).toEqual(updatingUser2);

  // test updating multiple users returning select columns
  const updateReturn3 = await userMapper.update().getAll({ name: 'Everyone' });
  expect(updateReturn3).toEqual([{ id: 1 }, { id: 10 }]);
  const updateReturn4 = await userMapper.update().getOne({ name: 'Everyone' });
  expect(updateReturn4).toEqual({ id: 1 });

  // test deleting a user
  const deleted = await userMapper.delete({ id: insertReturn1.id }).run();
  expect(deleted).toEqual(true);
  const selectedUser5 = await userMapper
    .select({ id: insertReturn1.id })
    .getOne();
  expect(selectedUser5).toBeNull();
});

it('inserts/updates/deletes a mapped object class w/ all custom transforms', async () => {
  class MappedUser {
    constructor(
      public serialNo: number,
      public firstName: string,
      public lastName: string,
      public handle: string,
      public email: string
    ) {}
  }

  const userMapper = new UniformTableMapper(db, 'users', {
    isMappedObject: (obj) => obj instanceof MappedUser,
    insertTransform: (user: MappedUser) => {
      return {
        name: `${user.firstName} ${user.lastName}`,
        handle: user.handle,
        email: user.email,
      };
    },
    insertReturnTransform: (user, returns) => {
      return new MappedUser(
        returns.id,
        user.firstName,
        user.lastName,
        user.handle,
        user.email
      );
    },
    updateTransform: (user) => {
      if (!(user instanceof MappedUser)) {
        return user;
      }
      return {
        name: `${user.firstName} ${user.lastName}`,
        handle: user.handle + '2',
        email: user.email,
      };
    },
    updateReturnTransform: (user, _returns) => {
      if (!(user instanceof MappedUser)) {
        return _returns;
      }
      return new MappedUser(
        user.serialNo,
        user.firstName,
        user.lastName,
        user.handle,
        user.email
      );
    },
    selectTransform: (row) => {
      const names = row.name.split(' ');
      return new MappedUser(row.id, names[0], names[1], row.handle, row.email);
    },
  });

  // test updating a non-existent user
  const updateReturn1 = await userMapper
    .update({ id: 1 })
    .getOne(
      new MappedUser(
        1,
        insertedUser1.firstName,
        insertedUser1.lastName,
        insertedUser1.handle,
        insertedUser1.email
      )
    );
  expect(updateReturn1).toEqual(null);

  // test inserting a user
  const insertedUser = new MappedUser(
    0,
    insertedUser1.firstName,
    insertedUser1.lastName,
    insertedUser1.handle,
    insertedUser1.email
  );
  const insertReturn = (await userMapper.insert().getOne(insertedUser))!;
  expect(insertReturn).not.toBeNull();
  expect(insertReturn.serialNo).toBeGreaterThan(0);

  // test getting a user by ID
  const selectedUser1 = await userMapper
    .select({ id: insertReturn.serialNo })
    .getOne();
  expect(selectedUser1).toEqual(insertReturn);
  expect(selectedUser1?.serialNo).toEqual(insertReturn.serialNo);

  // test updating a user, with returned object
  const updatingUser = new MappedUser(
    selectedUser1!.serialNo,
    selectedUser1!.firstName,
    'Xana',
    selectedUser1!.handle,
    selectedUser1!.email
  );
  const updateReturn2 = await userMapper
    .update({ id: updatingUser.serialNo })
    .getOne(updatingUser);
  expect(updateReturn2).toEqual(updatingUser);
  const selectedUser2 = await userMapper
    .select({ id: insertReturn.serialNo })
    .getOne();
  expect(selectedUser2?.serialNo).toEqual(selectedUser1!.serialNo);
  expect(selectedUser2?.handle).toEqual(selectedUser1!.handle + '2');

  // test updating a column with returns
  const updateColumnReturns = await userMapper
    .update(['id', '=', insertReturn.serialNo])
    .getAll({
      name: 'Foo Foo',
    });
  expect(updateColumnReturns).toEqual([{ id: selectedUser1!.serialNo }]);
  const selectedUser4 = await userMapper
    .select({ id: insertReturn.serialNo })
    .getOne();
  expect(selectedUser4?.firstName).toEqual('Foo');

  // test updating multiple users returning select columns
  const updateReturn3 = await userMapper.update().getAll({ name: 'Everyone' });
  expect(updateReturn3).toEqual([{ id: 1 }]);
  const updateReturn4 = await userMapper.update().getOne({ name: 'Everyone' });
  expect(updateReturn4).toEqual({ id: 1 });

  // test deleting a user
  const deleted = await userMapper.delete({ id: insertReturn.serialNo }).run();
  expect(deleted).toEqual(true);
  const selectedUser3 = await userMapper
    .select({ id: insertReturn.serialNo })
    .getOne();
  expect(selectedUser3).toBeNull();
});

it('inserts/updates/deletes a mapped object class w/ default update transforms', async () => {
  class MappedUser {
    constructor(
      public id: number,
      public firstName: string,
      public lastName: string,
      public handle: string,
      public email: string
    ) {}
  }

  const userMapper = new UniformTableMapper(db, 'users', {
    isMappedObject: (obj) => obj instanceof MappedUser,
    insertTransform: (user: MappedUser) => {
      return {
        name: `${user.firstName} ${user.lastName}`,
        handle: user.handle,
        email: user.email,
      };
    },
    insertReturnTransform: (user, returns) => {
      return new MappedUser(
        returns.id,
        user.firstName,
        user.lastName,
        user.handle,
        user.email
      );
    },
    selectTransform: (row) => {
      const names = row.name.split(' ');
      return new MappedUser(row.id, names[0], names[1], row.handle, row.email);
    },
  });

  // test updating a non-existent user
  const updateReturn1 = await userMapper
    .update({ id: 1 })
    .getOne(
      new MappedUser(
        1,
        insertedUser1.firstName,
        insertedUser1.lastName,
        insertedUser1.handle,
        insertedUser1.email
      )
    );
  expect(updateReturn1).toEqual(null);

  // test inserting a user
  const insertedUser = new MappedUser(
    0,
    insertedUser1.firstName,
    insertedUser1.lastName,
    insertedUser1.handle,
    insertedUser1.email
  );
  const insertReturn = (await userMapper.insert().getOne(insertedUser))!;
  expect(insertReturn).not.toBeNull();
  expect(insertReturn.id).toBeGreaterThan(0);

  // test getting a user by ID
  const selectedUser1 = await userMapper
    .select({ id: insertReturn.id })
    .getOne();
  expect(selectedUser1).toEqual(insertReturn);
  expect(selectedUser1?.id).toEqual(insertReturn.id);

  // test updating a user
  const updatingUser = new MappedUser(
    selectedUser1!.id,
    selectedUser1!.firstName,
    'Xana',
    selectedUser1!.handle,
    selectedUser1!.email
  );
  const updateReturn = await userMapper
    .update({ id: updatingUser.id })
    .getOne(updatingUser);
  expect(updateReturn).toEqual({ id: updatingUser.id });
  const selectedUser2 = await userMapper
    .select({ id: insertReturn.id })
    .getOne();
  expect(selectedUser2).toEqual(updatingUser);

  // test updating a user, without returned object
  const updatingUser2 = new MappedUser(
    selectedUser2!.id,
    'Super',
    'Man',
    selectedUser2!.handle,
    selectedUser2!.email
  );
  const updateReturn2 = await userMapper
    .update({ id: updatingUser2.id })
    .run(updatingUser2);
  expect(updateReturn2).toBe(true);
  const selectedUser3 = await userMapper
    .select({ id: insertReturn.id })
    .getOne();
  expect(selectedUser3).toEqual(updatingUser2);

  // test deleting a user
  const deleted = await userMapper.delete({ id: insertReturn.id }).run();
  expect(deleted).toEqual(true);
  const selectedUser4 = await userMapper
    .select({ id: insertReturn.id })
    .getOne();
  expect(selectedUser4).toBeNull();
});
