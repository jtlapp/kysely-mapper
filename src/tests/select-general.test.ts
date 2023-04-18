/**
 * Tests TableMapper.selectMany(), TableMapper.selectOne(), and query filters.
 */

import { Kysely } from 'kysely';

import { TableMapper } from '../mappers/table-mapper';
import { createDB, resetDB, destroyDB } from './utils/test-setup';
import { Database } from './utils/test-tables';
import {
  createUserMapperReturningID,
  createUserMapperReturningNothing,
} from './utils/test-mappers';
import { USERS } from './utils/test-objects';
import { ignore } from './utils/test-utils';

// TODO: what tests can I drop for now being redundant?

let db: Kysely<Database>;
let userMapper: ReturnType<typeof createUserMapperReturningID>;
let userMapperReturningNothing: ReturnType<
  typeof createUserMapperReturningNothing
>;

beforeAll(async () => {
  db = await createDB();
  userMapper = createUserMapperReturningID(db);
  userMapperReturningNothing = createUserMapperReturningNothing(db);
});
beforeEach(() => resetDB(db));
afterAll(() => destroyDB(db));

describe('general selection', () => {
  it('compiles an unparameterized select query', async () => {
    await userMapper.insert().run(USERS);

    const compilation = userMapper.select({ name: USERS[0].name }).compile();

    const users = await compilation.returnAll({});
    expect(users.length).toEqual(2);
    expect(users[0].handle).toEqual(USERS[0].handle);
    expect(users[1].handle).toEqual(USERS[2].handle);
    // Ensure that the provided columns are not optional
    ((_: string) => {})(users[0].handle);

    const user = await compilation.returnOne({});
    expect(user?.handle).toEqual(USERS[0].handle);
    // Ensure that the provided columns are not optional
    ((_: string) => {})(user!.name);

    ignore('compilation type errors', () => {
      // @ts-expect-error - errors on invalid column names
      users[0].notThere;
      // @ts-expect-error - errors on invalid column names
      user!.notThere;
    });
  });

  it('parameterizes and compiles a select query', async () => {
    await userMapper.insert().run(USERS);

    const parameterization = userMapper.parameterize<{ name: string }>(
      ({ mapper, param }) => mapper.select({ name: param('name') })
    );

    // test returnAll() returning multiple
    const users = await parameterization.returnAll({ name: USERS[0].name });
    expect(users.length).toEqual(2);
    expect(users[0].handle).toEqual(USERS[0].handle);
    expect(users[1].handle).toEqual(USERS[2].handle);
    // Ensure that the provided columns are not optional
    ((_: string) => {})(users[0].handle);

    // test returnAll() returning none
    const users2 = await parameterization.returnAll({ name: 'not there' });
    expect(users2.length).toEqual(0);

    // test returnOne() returning one
    const user = await parameterization.returnOne({ name: USERS[1].name });
    expect(user?.handle).toEqual(USERS[1].handle);
    // Ensure that the provided columns are not optional
    ((_: string) => {})(user!.name);

    // test returnOne() returning none
    const user2 = await parameterization.returnOne({ name: 'not there' });
    expect(user2).toBeNull();

    ignore('parameterization type errors', () => {
      // @ts-expect-error - errors on invalid parameter names
      parameterization.returnAll({ notThere: 'foo' });
      // @ts-expect-error - errors on invalid column names
      users[0].notThere;
      // @ts-expect-error - errors on invalid column names
      user!.notThere;
      userMapper.parameterize<{ name: string }>(
        // @ts-expect-error - errors on invalid parameter name
        ({ mapper, param }) => mapper.select({ name: param('notThere') })
      );
      userMapper.parameterize<{ name: number }>(
        // @ts-expect-error - errors on invalid parameter type
        ({ mapper, param }) => mapper.select({ name: param('name') })
      );
      // @ts-expect-error - errors on invalid parameter value name
      parameterization.returnOne({ notThere: 'foo' });
      // @ts-expect-error - errors on invalid parameter value type
      parameterization.returnOne({ name: 123 });
    });
  });

  it('modifies the underlying query builder', async () => {
    await userMapper.insert().run(USERS);

    const users = await userMapper
      .select()
      .modify((qb) =>
        qb.where('name', '=', USERS[0].name).orderBy('handle', 'desc')
      )
      .returnAll();
    expect(users.length).toEqual(2);
    expect(users[0].handle).toEqual(USERS[2].handle);
    expect(users[1].handle).toEqual(USERS[0].handle);

    const user = await userMapper
      .select()
      .modify((qb) =>
        qb.where('name', '=', USERS[0].name).orderBy('handle', 'desc')
      )
      .returnOne();
    expect(user?.handle).toEqual(USERS[2].handle);
  });

  it('does not modify the underlying selected columns', async () => {
    await userMapper.insert().run(USERS);

    const users = await userMapper
      .select()
      .modify((qb) => qb.select('name').orderBy('handle', 'desc'))
      .returnAll();
    expect(users).toEqual([
      { ...USERS[2], id: 3 },
      { ...USERS[1], id: 2 },
      { ...USERS[0], id: 1 },
    ]);
    // Ensure that columns can be addressed by name.
    ((_: number) => {})(users[0].id);
    ((_: string) => {})(users[0].handle);
    ((_: string) => {})(users[0].name);
    ((_: string) => {})(users[0].email!);

    const user = await userMapper
      .select()
      .modify((qb) => qb.select('name').orderBy('handle', 'desc'))
      .returnOne();
    expect(user).toEqual({ ...USERS[2], id: 3 });
    // Ensure that columns can be addressed by name.
    ((_: number) => {})(user!.id);
    ((_: string) => {})(user!.handle);
    ((_: string) => {})(user!.name);
    ((_: string) => {})(user!.email!);

    ignore('detects modify() type errors', async () => {
      // @ts-expect-error - cannot access invalid columns
      users[0].notThere;
      // @ts-expect-error - cannot access invalid columns
      user!.notThere;
    });
  });

  it('selects via a multi-column key tuple (definition order)', async () => {
    const mapper = new TableMapper(db, 'users', {
      keyColumns: ['id', 'name'],
    });
    await mapper.insert().run(USERS);

    const users = await mapper.select([3, 'Sue']).returnAll();
    expect(users.length).toEqual(1);
    expect(users[0].name).toEqual(USERS[2].name);

    ignore('detects key colum tuple type errors', () => {
      // @ts-expect-error - key tuple must have correct length
      mapper.select(['Sue']);
      // @ts-expect-error - key tuple must have correct length
      mapper.select(['Sue', 3, 'foo']);
      // @ts-expect-error - key tuple must have correct types
      mapper.select(['Sue', 'foo']);
      // @ts-expect-error - primitive key values are not allowed
      mapper.select('Sue');
      // @ts-expect-error - primitive key values are not allowed
      mapper.select(1);
    });
  });

  it('selects via a multi-column key tuple (different order)', async () => {
    const mapper = new TableMapper(db, 'users', {
      keyColumns: ['name', 'id'],
    });
    await mapper.insert().run(USERS);

    const users = await mapper.select(['Sue', 3]).returnAll();
    expect(users.length).toEqual(1);
    expect(users[0].name).toEqual(USERS[2].name);

    ignore('detects key colum tuple type errors', () => {
      // @ts-expect-error - key tuple must have correct length
      mapper.select(['Sue']);
      // @ts-expect-error - key tuple must have correct length
      mapper.select(['Sue', 3, 'foo']);
      // @ts-expect-error - key tuple must have correct types
      mapper.select(['Sue', 'foo']);
      // @ts-expect-error - primitive key values are not allowed
      mapper.select('Sue');
      // @ts-expect-error - primitive key values are not allowed
      mapper.select(1);
    });
  });

  ignore('detects select(filter) type errors', async () => {
    // @ts-expect-error - doesn't allow only two arguments
    userMapper.select('name', '=');
    // @ts-expect-error - object filter fields must be valid
    userMapper.select({ notThere: 'xyz' });
    userMapper.select(({ or, cmpr }) =>
      // @ts-expect-error - where expression columns must be valid
      or([cmpr('notThere', '=', 'Sue')])
    );
    // @ts-expect-error - binary op filter fields must be valid
    userMapper.select('notThere', '=', 'foo');
    // @ts-expect-error - binary op filter fields must be valid
    userMapper.select('users.notThere', '=', 'foo');
    // @ts-expect-error - ID filter must have correct type
    userMapper.select('str');
    // @ts-expect-error - ID filter must have correct type
    userMapper.select(['str']);
    // @ts-expect-error - ID filter not allowed when when no ID column
    userMapperReturningNothing.select(1);
    // @ts-expect-error - ID filter not allowed when when no ID column
    userMapperReturningNothing.select([1]);
  });
});
