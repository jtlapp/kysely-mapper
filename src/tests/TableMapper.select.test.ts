/**
 * Tests TableMapper.selectMany(), TableMapper.selectOne(), and query filters.
 */

import { Kysely, sql } from 'kysely';

import { TableMapper } from '../mappers/table-mapper';
import { createDB, resetDB, destroyDB } from './utils/test-setup';
import { Database } from './utils/test-tables';
import {
  UserTableMapperReturningID,
  UserTableMapperReturningNothing,
} from './utils/test-mappers';
import { USERS } from './utils/test-objects';
import { ignore } from './utils/test-utils';

// TODO: what tests can I drop for now being redundant?

let db: Kysely<Database>;
let userMapper: UserTableMapperReturningID;
let userMapperReturningNothing: UserTableMapperReturningNothing;

beforeAll(async () => {
  db = await createDB();
  userMapper = new UserTableMapperReturningID(db);
  userMapperReturningNothing = new UserTableMapperReturningNothing(db);
});
beforeEach(() => resetDB(db));
afterAll(() => destroyDB(db));

describe('general selection', () => {
  // TODO: test parameterized queries only returning SelectedColumns and aliases

  // it('parameterizes a selection', async () => {
  //   await userMapper.insert().run(USERS);

  //   const parameterization = userMapper
  //     .select()
  //     .parameterize<{ name: string }>(({ q, param }) =>
  //       q.filter({
  //         name: param('name'),
  //       })
  //     );

  //   const users = await parameterization.returnAll(db, {
  //     name: USERS[0].name,
  //   });
  //   expect(users.length).toEqual(2);
  //   expect(users[0].handle).toEqual(USERS[0].handle);
  //   expect(users[1].handle).toEqual(USERS[2].handle);
  //   // Ensure that the provided columns are not optional
  //   ((_: string) => {})(users[0].handle);

  //   const user = await parameterization.returnOne(db, {
  //     name: USERS[0].name,
  //   });
  //   expect(user?.handle).toEqual(USERS[0].handle);
  //   // Ensure that the provided columns are not optional
  //   ((_: string) => {})(user!.name);

  //   ignore('parameterization type errors', () => {
  //     // @ts-expect-error - errors on invalid parameter names
  //     parameterization.returnAll(db, { notThere: 'foo' });
  //     // @ts-expect-error - errors on invalid column names
  //     users[0].notThere;
  //     // @ts-expect-error - errors on invalid column names
  //     user!.notThere;
  //   });
  // });

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
    ((_: string) => {})(users[0].email);

    const user = await userMapper
      .select()
      .modify((qb) => qb.select('name').orderBy('handle', 'desc'))
      .returnOne();
    expect(user).toEqual({ ...USERS[2], id: 3 });
    // Ensure that columns can be addressed by name.
    ((_: number) => {})(user!.id);
    ((_: string) => {})(user!.handle);
    ((_: string) => {})(user!.name);
    ((_: string) => {})(user!.email);

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

describe('select() returnAll()', () => {
  it('selects nothing when nothing matches filter', async () => {
    await userMapper.insert().run(USERS);

    const users = await userMapper.select({ name: 'Not There' }).returnAll();
    expect(users.length).toEqual(0);
  });

  it('selects all rows with no filter', async () => {
    await userMapper.insert().run(USERS);

    // Test selecting all
    const users = await userMapper.select().returnAll();
    expect(users.length).toEqual(USERS.length);
    for (let i = 0; i < USERS.length; i++) {
      expect(users[i].handle).toEqual(USERS[i].handle);
    }
  });

  it('selects via key column values', async () => {
    await userMapper.insert().run(USERS);

    // Test selecting via key value
    const users1 = await userMapper.select(2).returnAll();
    expect(users1.length).toEqual(1);
    expect(users1[0].handle).toEqual(USERS[1].handle);

    // Test selecting via key tuple
    const users2 = await userMapper.select([2]).returnAll();
    expect(users2.length).toEqual(1);
    expect(users2[0].handle).toEqual(USERS[1].handle);
  });

  it('selects with a matching field filter', async () => {
    await userMapper.insert().run(USERS);

    let users = await userMapper
      .select({
        name: USERS[0].name,
      })
      .returnAll();
    expect(users.length).toEqual(2);
    expect(users[0].handle).toEqual(USERS[0].handle);
    expect(users[1].handle).toEqual(USERS[2].handle);

    users = await userMapper
      .select({
        name: USERS[0].name,
        handle: USERS[2].handle,
      })
      .returnAll();
    expect(users.length).toEqual(1);
    expect(users[0].handle).toEqual(USERS[2].handle);
  });

  it('selects with a binary operation filter', async () => {
    await userMapper.insert().run(USERS);

    // Test selecting by condition (with results)
    let users = await userMapper.select('name', '=', USERS[0].name).returnAll();
    expect(users.length).toEqual(2);
    expect(users[0].handle).toEqual(USERS[0].handle);
    expect(users[1].handle).toEqual(USERS[2].handle);

    // Test selecting by condition (no results)
    users = await userMapper.select('name', '=', 'nonexistent').returnAll();
    expect(users.length).toEqual(0);
  });

  it('selects with a query expression filter', async () => {
    await userMapper.insert().run(USERS);

    const users = await userMapper
      .select(sql`name != ${USERS[0].name}`)
      .returnAll();
    expect(users.length).toEqual(1);
    expect(users[0].handle).toEqual(USERS[1].handle);
  });

  it('selects with a matching field filter via filter()', async () => {
    await userMapper.insert().run(USERS);

    let users = await userMapper
      .select({
        name: USERS[0].name,
      })
      .returnAll();
    expect(users.length).toEqual(2);
    expect(users[0].handle).toEqual(USERS[0].handle);
    expect(users[1].handle).toEqual(USERS[2].handle);

    users = await userMapper
      .select({
        name: USERS[0].name,
        handle: USERS[2].handle,
      })
      .returnAll();
    expect(users.length).toEqual(1);
    expect(users[0].handle).toEqual(USERS[2].handle);
  });

  it('selects with a binary operation filter via filter()', async () => {
    await userMapper.insert().run(USERS);

    // Test selecting by condition (with results)
    let users = await userMapper.select('name', '=', USERS[0].name).returnAll();
    expect(users.length).toEqual(2);
    expect(users[0].handle).toEqual(USERS[0].handle);
    expect(users[1].handle).toEqual(USERS[2].handle);

    // Test selecting by condition (no results)
    users = await userMapper.select('name', '=', 'nonexistent').returnAll();
    expect(users.length).toEqual(0);
  });

  it('selects many returning selected columns and aliases', async () => {
    const ids = await userMapper.insert().returnAll(USERS);
    const mapper = new TableMapper(db, 'users', {
      selectedColumns: ['id', 'handle as h'],
    });

    // Should allow access to aliased columns
    (await mapper.select().returnAll())[0].h;

    const users = await mapper.select({ name: USERS[0].name }).returnAll();
    expect(users).toEqual([
      {
        id: ids[0].id,
        h: USERS[0].handle,
      },
      {
        id: ids[2].id,
        h: USERS[2].handle,
      },
    ]);

    ignore('inaccessible types are not allowed', async () => {
      // @ts-expect-error - aliases are not allowed in filter expressions
      mapper.select({ h: USERS[0].handle });
      // @ts-expect-error - unselected columns are not allowed
      (await mapper.select().returnAll())[0].name;
    });
  });

  ignore('detects select() returnAll() simple filter type errors', async () => {
    // @ts-expect-error - only table columns are accessible unfiltered
    (await userMapper.select().returnAll())[0].notThere;
    // @ts-expect-error - only table columns are accessible unfiltered
    (await userMapper.select({}).returnAll())[0].notThere;
    // @ts-expect-error - only table columns are accessible w/ object filter
    // prettier-ignore
    (await userMapper.select({ name: "Sue" }).returnAll())[0].notThere;
    // @ts-expect-error - only table columns are accessible w/ op filter
    // prettier-ignore
    (await userMapper.select("name", "=", "Sue").returnAll())[0].notThere;
    // prettier-ignore
    (
        await userMapper
          .select((qb) => qb)
          .returnAll()
        // @ts-expect-error - only table columns are accessible w/ QB filter
      )[0].notThere;
    // prettier-ignore
    (
        await userMapper
          .select(sql`name = 'Sue'`)
          .returnAll()
        // @ts-expect-error - only table columns are accessible w/ expr filter
      )[0].notThere;
  });
});

describe('select() returnOne()', () => {
  it('selects the first row with no filter', async () => {
    await userMapper.insert().run(USERS);

    let user = await userMapper.select().returnOne();
    expect(user?.handle).toEqual(USERS[0].handle);

    user = await userMapper.select({}).returnOne();
    expect(user?.handle).toEqual(USERS[0].handle);
  });

  it('selects the first row with a matching field filter', async () => {
    await userMapper.insert().run(USERS);

    let user = await userMapper.select({ name: USERS[0].name }).returnOne();
    expect(user?.handle).toEqual(USERS[0].handle);

    user = await userMapper
      .select({
        name: USERS[0].name,
        handle: USERS[2].handle,
      })
      .returnOne();
    expect(user?.handle).toEqual(USERS[2].handle);
  });

  it('selects the first row with a binary operation filter', async () => {
    await userMapper.insert().run(USERS);

    // Test selecting by condition (with result)
    let user = await userMapper.select('name', '=', USERS[0].name).returnOne();
    expect(user?.handle).toEqual(USERS[0].handle);

    // Test selecting by condition (no result)
    user = await userMapper.select('name', '=', 'nonexistent').returnOne();
    expect(user).toBeNull();
  });

  it('selects the first row with a query expression filter', async () => {
    await userMapper.insert().run(USERS);

    const user = await userMapper
      .select(sql`name != ${USERS[0].name}`)
      .returnOne();
    expect(user?.handle).toEqual(USERS[1].handle);
  });

  it('selects the first row with a compound filter', async () => {
    const userIDs = await userMapper.insert().returnAll(USERS);

    const user = await userMapper
      .select(({ and, cmpr }) =>
        and([cmpr('name', '=', USERS[0].name), cmpr('id', '>', userIDs[0].id)])
      )
      .returnOne();
    expect(user?.handle).toEqual(USERS[2].handle);
  });

  it('selects the first row with a matching field filter via filter()', async () => {
    await userMapper.insert().run(USERS);

    let user = await userMapper.select({ name: USERS[0].name }).returnOne();
    expect(user?.handle).toEqual(USERS[0].handle);

    user = await userMapper
      .select({
        name: USERS[0].name,
        handle: USERS[2].handle,
      })
      .returnOne();
    expect(user?.handle).toEqual(USERS[2].handle);
  });

  it('selects the first row with a binary operation filter via filter()', async () => {
    await userMapper.insert().run(USERS);

    // Test selecting by condition (with result)
    let user = await userMapper.select('name', '=', USERS[0].name).returnOne();
    expect(user?.handle).toEqual(USERS[0].handle);

    // Test selecting by condition (no result)
    user = await userMapper.select('name', '=', 'nonexistent').returnOne();
    expect(user).toBeNull();
  });

  it('selects one returning selected columns and aliases', async () => {
    const ids = await userMapper.insert().returnAll(USERS);
    const mapper = new TableMapper(db, 'users', {
      selectedColumns: ['id', 'handle as h'],
    });

    // Should allow access to aliased columns
    (await mapper.select().returnOne())!.h;

    const user = await mapper.select({ handle: USERS[0].handle }).returnOne();
    expect(user).toEqual({ id: ids[0].id, h: USERS[0].handle });

    ignore('inaccessible types are not allowed', async () => {
      // @ts-expect-error - unselected columns are not allowed
      (await mapper.select().returnAll())[0].name;
    });
  });

  ignore('detects select() returnOne() type errors', async () => {
    // @ts-expect-error - only table columns are accessible unfiltered
    (await userMapper.select({}).returnOne()).notThere;
    // @ts-expect-error - only table columns are accessible w/ object filter
    (await userMapper.select({ name: 'Sue' }).returnOne()).notThere;
    // @ts-expect-error - only table columns are accessible w/ op filter
    // prettier-ignore
    (await userMapper.select("name", "=", "Sue").returnOne()).notThere;
    // prettier-ignore
    (
      await userMapper
        .select((qb) => qb)
        .returnOne()
      // @ts-expect-error - only table columns are accessible w/ QB filter
    )!.notThere;
    // prettier-ignore
    (
      await userMapper
        .select(sql`name = 'Sue'`)
        .returnOne()
      // @ts-expect-error - only table columns are accessible w/ expr filter
    )!.notThere;
  });
});
