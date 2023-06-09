import { Kysely, Updateable } from 'kysely';

import { TableMapper } from '../mappers/table-mapper';
import { createDB, resetDB, destroyDB } from './utils/test-setup';
import { Database, Users } from './utils/test-tables';
import {
  createUserMapperReturningID,
  createUserMapperReturningIDAndHandleAsH,
  createUserMapperReturningNothing,
} from './utils/test-mappers';
import { USERS } from './utils/test-objects';
import { ignore } from './utils/test-utils';
import { User } from './utils/test-types';

let db: Kysely<Database>;
let userMapperReturningNothing: ReturnType<
  typeof createUserMapperReturningNothing
>;
let userMapperReturningID: ReturnType<typeof createUserMapperReturningID>;
let userMapperReturningIDAndHandleAsH: ReturnType<
  typeof createUserMapperReturningIDAndHandleAsH
>;

beforeAll(async () => {
  db = await createDB();
  userMapperReturningNothing = createUserMapperReturningNothing(db);
  userMapperReturningID = createUserMapperReturningID(db);
  userMapperReturningIDAndHandleAsH =
    createUserMapperReturningIDAndHandleAsH(db);
});
beforeEach(() => resetDB(db));
afterAll(() => destroyDB(db));

describe('compiled updates', () => {
  it('updates nothing returning zero update count', async () => {
    const updateValues = { email: 'new.email@xyz.pdq' };

    const compilation = userMapperReturningID
      .update({ id: 1 })
      .columns(['email'])
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

  it('compilations accept readonly updating objects', async () => {
    const compilation = userMapperReturningNothing
      .update('id', '=', 1)
      .columns(['name', 'email'])
      .compile();
    const updateValues1 = {
      name: 'Sue Rex' as const,
      email: 'srex@abc.def' as const,
    } as const;
    await compilation.run({}, updateValues1);
  });

  it('compiles a non-returning update query without transformation', async () => {
    const insertReturns = await userMapperReturningID.insert().returnAll(USERS);
    const compilation = userMapperReturningNothing
      .update('id', '=', insertReturns[0].id)
      .columns(['name', 'email'])
      .compile();

    // test run()
    const updateValues1 = {
      name: 'Sue Rex' as const,
      email: 'srex@abc.def' as const,
    } as const;
    const updateReturns1 = await compilation.run({}, updateValues1);
    expect(updateReturns1).toBe(true);
    const readUser1 = await userMapperReturningID
      .select({ id: insertReturns[0].id })
      .returnOne();
    expect(readUser1?.name).toEqual(updateValues1.name);
    expect(readUser1?.email).toEqual(updateValues1.email);

    // test returnOne()
    const updateValues2 = {
      name: 'Johnny Rex' as const,
      email: 'jrex@abc.def' as const,
    } as const;
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

  it('accepts readonly parameters and updating objects', async () => {
    const parameterization = userMapperReturningIDAndHandleAsH.parameterize<{
      id: number;
    }>(({ mapper, param }) =>
      mapper.update({ id: param('id') }).columns(['name'])
    );

    const params = { id: 1 as const } as const;
    const updateValues = {
      name: 'Sue Rex' as const,
      email: 'srex@abc.def' as const,
    } as const;
    await parameterization.run(params, updateValues);
    await parameterization.returnAll(params, updateValues);
    await parameterization.returnOne(params, updateValues);
    await parameterization.returnCount(params, updateValues);
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

  it('compiles an update query with transformation', async () => {
    expect.assertions(12);

    const columnSubset: (keyof Updateable<Users>)[] = ['name'];
    const transformMapper = new TableMapper(db, 'users', {
      insertReturnColumns: ['*'],
      updateReturnColumns: ['*'],
    }).withTransforms({
      selectTransform: (row) => {
        const names = row.name.split(' ');
        return new User(row.id, names[0], names[1], row.handle, row.email);
      },
      insertTransform: (source: User) => ({
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
      updateTransform: (source: User, columns) => {
        expect(columns).toEqual(columnSubset);
        return {
          name: `${source.firstName} ${source.lastName}`,
          handle: source.handle,
          email: source.email,
        };
      },
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
    });

    const user1 = new User(0, 'John', 'Doe', 'johndoe', 'jdoe@abc.def');
    const user2 = new User(0, 'Sam', 'Gamgee', 'sg', 'sg@abc.def');
    const user3 = new User(0, 'Sue', 'Rex', 'srex', 'srex@abc.def');
    const insertReturns = await transformMapper
      .insert()
      .returnAll([user1, user2, user3]);

    const compilation = transformMapper
      .update({ id: insertReturns[2].id })
      .columns(columnSubset)
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
    const transformMapper = new TableMapper(db, 'users', {
      insertReturnColumns: ['id'],
      updateReturnColumns: ['id'],
    }).withTransforms({
      selectTransform: (row) => {
        const names = row.name.split(' ');
        return new User(row.id, names[0], names[1], row.handle, row.email);
      },
      insertTransform: (source: User) => ({
        name: `${source.firstName} ${source.lastName}`,
        handle: source.handle,
        email: source.email,
      }),
      insertReturnTransform: (source: User, returns) => ({
        id: returns.id,
        firstName: source.firstName,
        lastName: source.lastName,
      }),
      updateTransform: (source: User) => ({
        name: `${source.firstName} ${source.lastName}`,
        handle: source.handle,
        email: source.email,
      }),
      updateReturnTransform: (source: User, returns) => ({
        id: returns.id,
        firstName: source.firstName,
        lastName: source.lastName,
      }),
      countTransform: (count) => Number(count),
    });

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

  it('requires all indicated columns to be updated', async () => {
    await userMapperReturningID.insert().run(USERS);

    const compilation = userMapperReturningID
      .update()
      .columns(['name', 'handle', 'email'])
      .compile();

    const updateValues = { name: 'John Doe', handle: 'johndoe' };

    expect(() => compilation.returnOne({}, updateValues)).rejects.toThrow(
      `column 'email' missing`
    );

    const success = await compilation.run({}, { ...updateValues, email: null });
    expect(success).toBe(true);
  });
});
