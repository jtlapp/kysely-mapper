import { Insertable, Kysely } from 'kysely';

import { createDB, resetDB, destroyDB } from './utils/test-setup';
import { Database, Users } from './utils/test-tables';
import { USERS, insertedUser1 } from './utils/test-objects';
import { UniformTableMapper } from '../mappers/UniformTableMapper';

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
  expect(selectedUser1).toEqual(insertReturn1);
  expect(selectedUser1?.id).toEqual(insertReturn1.id);

  // test inserting a user with truthy id
  const insertedUser2 = new MappedUser(
    10,
    USERS[1].name,
    USERS[1].handle,
    USERS[1].email
  );
  const insertReturn2 = (await userMapper.insert().getOne(insertedUser2))!;
  expect(insertReturn2).toEqual(insertedUser2);
  const selectedUser2 = await userMapper
    .select({ id: insertReturn2.id })
    .getOne();
  expect(selectedUser2).toEqual(insertedUser2);

  // test updating a user, with returned object
  const updaterUser = new MappedUser(
    selectedUser1!.id,
    'Xana',
    selectedUser1!.handle,
    selectedUser1!.email
  );
  const updateReturn = await userMapper
    .update({ id: updaterUser.id })
    .getOne(updaterUser);
  expect(updateReturn).toEqual(updaterUser);
  const selectedUser3 = await userMapper
    .select({ id: insertReturn1.id })
    .getOne();
  expect(selectedUser3).toEqual(updateReturn);

  // test updating a user, without returned object
  const updaterUser2 = new MappedUser(
    selectedUser3!.id,
    'Freddy',
    selectedUser3!.handle,
    selectedUser3!.email
  );
  const updateReturn2 = await userMapper
    .update({ id: updaterUser2.id })
    .run(updaterUser2);
  expect(updateReturn2).toBe(true);
  const selectedUser4 = await userMapper
    .select({ id: insertReturn1.id })
    .getOne();
  expect(selectedUser4).toEqual(updaterUser2);

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
    updaterTransform: (user: MappedUser | Partial<Insertable<Users>>) => {
      if (!(user instanceof MappedUser)) {
        return user;
      }
      return {
        name: `${user.firstName} ${user.lastName}`,
        handle: user.handle + '2',
        email: user.email,
      };
    },
    // TODO: IMPORTANT: If updater obj is not of return type,
    //  can't necessarily flesh out return type
    updateReturnTransform: (user, _returns) => {
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
  const updaterUser = new MappedUser(
    selectedUser1!.serialNo,
    selectedUser1!.firstName,
    'Xana',
    selectedUser1!.handle,
    selectedUser1!.email
  );
  const updateReturn = await userMapper
    .update({ id: updaterUser.serialNo })
    .getOne(updaterUser);
  expect(updateReturn).toEqual(updaterUser);
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

  // test deleting a user
  const deleted = await userMapper.delete({ id: insertReturn.serialNo }).run();
  expect(deleted).toEqual(true);
  const selectedUser3 = await userMapper
    .select({ id: insertReturn.serialNo })
    .getOne();
  expect(selectedUser3).toBeNull();
});

it('inserts/updates/deletes a mapped object class w/ inferred update transforms', async () => {
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
    updaterTransform: (user: MappedUser | Partial<Insertable<Users>>) => {
      if (!(user instanceof MappedUser)) {
        return user;
      }
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
  const updaterUser = new MappedUser(
    selectedUser1!.id,
    selectedUser1!.firstName,
    'Xana',
    selectedUser1!.handle,
    selectedUser1!.email
  );
  const updateReturn = await userMapper
    .update({ id: updaterUser.id })
    .getOne(updaterUser);
  expect(updateReturn).toEqual(updaterUser);
  const selectedUser2 = await userMapper
    .select({ id: insertReturn.id })
    .getOne();
  expect(selectedUser2).toEqual(updateReturn);

  // test updating a user, without returned object
  const updaterUser2 = new MappedUser(
    selectedUser2!.id,
    'Super',
    'Man',
    selectedUser2!.handle,
    selectedUser2!.email
  );
  const updateReturn2 = await userMapper
    .update({ id: updaterUser2.id })
    .run(updaterUser2);
  expect(updateReturn2).toBe(true);
  const selectedUser3 = await userMapper
    .select({ id: insertReturn.id })
    .getOne();
  expect(selectedUser3).toEqual(updaterUser2);

  // test deleting a user
  const deleted = await userMapper.delete({ id: insertReturn.id }).run();
  expect(deleted).toEqual(true);
  const selectedUser4 = await userMapper
    .select({ id: insertReturn.id })
    .getOne();
  expect(selectedUser4).toBeNull();
});
