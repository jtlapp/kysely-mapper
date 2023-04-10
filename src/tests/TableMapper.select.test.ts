/**
 * Tests TableMapper.selectMany(), TableMapper.selectOne(), and query filters.
 */

import { Kysely, sql } from 'kysely';

import { TableMapper } from '../mappers/table-mapper/table-mapper';
import { createDB, resetDB, destroyDB } from './utils/test-setup';
import { Database } from './utils/test-tables';
import { UserTableMapperReturningID } from './utils/test-mappers';
import { USERS } from './utils/test-objects';
import { ignore } from './utils/test-utils';

// TODO: what tests can I drop for now being redundant?

let db: Kysely<Database>;
let userMapper: UserTableMapperReturningID;

beforeAll(async () => {
  db = await createDB();
  userMapper = new UserTableMapperReturningID(db);
});
beforeEach(() => resetDB(db));
afterAll(() => destroyDB(db));

describe('BUILDER: general selection', () => {
  it('BUILDER: selectedColumnsQB() allows for selecting rows', async () => {
    // TODO: test more complex behavior of selectedColumnsQB()

    await db
      .insertInto('users')
      .values(USERS[0])
      .returningAll()
      .executeTakeFirst()!;
    const user1 = (await db
      .insertInto('users')
      .values(USERS[1])
      .returningAll()
      .executeTakeFirst())!;

    const readUser1 = await userMapper
      .selectedColumnsQB()
      .where('id', '=', user1.id)
      .executeTakeFirst();
    expect(readUser1?.handle).toEqual(USERS[1].handle);
    expect(readUser1?.email).toEqual(USERS[1].email);
  });

  // TODO: test parameterized queries only returning SelectedColumns and aliases

  it('BUILDER: parameterizes a selection', async () => {
    await userMapper.insert(USERS);

    const parameterization = userMapper
      .select()
      .parameterize<{ name: string }>(({ q, param }) =>
        q.filter({
          name: param('name'),
        })
      );

    const users = await parameterization.getMany(db, {
      name: USERS[0].name,
    });
    expect(users.length).toEqual(2);
    expect(users[0].handle).toEqual(USERS[0].handle);
    expect(users[1].handle).toEqual(USERS[2].handle);
    // Ensure that the provided columns are not optional
    ((_: string) => {})(users[0].handle);

    const user = await parameterization.getOne(db, {
      name: USERS[0].name,
    });
    expect(user?.handle).toEqual(USERS[0].handle);
    // Ensure that the provided columns are not optional
    ((_: string) => {})(user!.name);

    ignore('BUILDER: parameterization type errors', () => {
      // @ts-expect-error - errors on invalid parameter names
      parameterization.getMany(db, { notThere: 'foo' });
      // @ts-expect-error - errors on invalid column names
      users[0].notThere;
      // @ts-expect-error - errors on invalid column names
      user!.notThere;
    });
  });

  it('BUILDER: modifies the underlying query builder', async () => {
    await userMapper.insert(USERS);

    const users = await userMapper
      .select()
      .modify((qb) =>
        qb.where('name', '=', USERS[0].name).orderBy('handle', 'desc')
      )
      .getMany();
    expect(users.length).toEqual(2);
    expect(users[0].handle).toEqual(USERS[2].handle);
    expect(users[1].handle).toEqual(USERS[0].handle);

    const user = await userMapper
      .select()
      .modify((qb) =>
        qb.where('name', '=', USERS[0].name).orderBy('handle', 'desc')
      )
      .getOne();
    expect(user?.handle).toEqual(USERS[2].handle);
  });

  it('BUILDER: does not modify the underlying selected columns', async () => {
    await userMapper.insert(USERS);

    const users = await userMapper
      .select()
      .modify((qb) => qb.select('name').orderBy('handle', 'desc'))
      .getMany();
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
      .getOne();
    expect(user).toEqual({ ...USERS[2], id: 3 });
    // Ensure that columns can be addressed by name.
    ((_: number) => {})(user!.id);
    ((_: string) => {})(user!.handle);
    ((_: string) => {})(user!.name);
    ((_: string) => {})(user!.email);

    ignore('BUILDER: detects modify() type errors', async () => {
      // @ts-expect-error - cannot access invalid columns
      users[0].notThere;
      // @ts-expect-error - cannot access invalid columns
      user!.notThere;
    });
  });

  ignore('BUILDER: detects select(filter) type errors', async () => {
    // @ts-expect-error - doesn't allow plain string expressions
    userMapper.select("name = 'John Doe'");
    // @ts-expect-error - doesn't allow only two arguments
    userMapper.select('name', '=');
    // @ts-expect-error - object filter fields must be valid
    userMapper.select({ notThere: 'xyz' });
    userMapper.select(({ or, cmpr }) =>
      // @ts-expect-error - where expression columns must be valid
      or([cmpr('notThere', '=', 'Sue')])
    );
    // @ts-expect-error - binary op filter fields must be valid
    userMapper.select(['notThere', '=', 'foo']);
    // @ts-expect-error - binary op filter fields must be valid
    userMapper.select(['users.notThere', '=', 'foo']);
  });

  ignore('BUILDER: detects select().filter() type errors', async () => {
    // @ts-expect-error - doesn't allow plain string expressions
    userMapper.select().filter("name = 'John Doe'");
    // @ts-expect-error - doesn't allow only two arguments
    userMapper.select().filter('name', '=');
    // @ts-expect-error - object filter fields must be valid
    userMapper.select().filter({ notThere: 'xyz' });
    userMapper.select().filter(({ or, cmpr }) =>
      // @ts-expect-error - where expression columns must be valid
      or([cmpr('notThere', '=', 'Sue')])
    );
    // @ts-expect-error - binary op filter fields must be valid
    userMapper.select().filter(['notThere', '=', 'foo']);
    // @ts-expect-error - binary op filter fields must be valid
    userMapper.select().filter(['users.notThere', '=', 'foo']);
  });
});

describe('BUILDER: select() getMany()', () => {
  it('BUILDER: selects nothing when nothing matches filter', async () => {
    await userMapper.insert(USERS);

    const users = await userMapper.select({ name: 'Not There' }).getMany();
    expect(users.length).toEqual(0);
  });

  it('BUILDER: selects all rows with no filter', async () => {
    await userMapper.insert(USERS);

    // Test selecting all
    const users = await userMapper.select().getMany();
    expect(users.length).toEqual(USERS.length);
    for (let i = 0; i < USERS.length; i++) {
      expect(users[i].handle).toEqual(USERS[i].handle);
    }
  });

  it('BUILDER: selects with a matching field filter', async () => {
    await userMapper.insert(USERS);

    let users = await userMapper
      .select({
        name: USERS[0].name,
      })
      .getMany();
    expect(users.length).toEqual(2);
    expect(users[0].handle).toEqual(USERS[0].handle);
    expect(users[1].handle).toEqual(USERS[2].handle);

    users = await userMapper
      .select()
      .filter({
        name: USERS[0].name,
        handle: USERS[2].handle,
      })
      .getMany();
    expect(users.length).toEqual(1);
    expect(users[0].handle).toEqual(USERS[2].handle);
  });

  it('BUILDER: selects with a binary operation filter', async () => {
    await userMapper.insert(USERS);

    // Test selecting by condition (with results)
    let users = await userMapper.select(['name', '=', USERS[0].name]).getMany();
    expect(users.length).toEqual(2);
    expect(users[0].handle).toEqual(USERS[0].handle);
    expect(users[1].handle).toEqual(USERS[2].handle);

    // Test selecting by condition (no results)
    users = await userMapper.select(['name', '=', 'nonexistent']).getMany();
    expect(users.length).toEqual(0);
  });

  it('BUILDER: selects with a query expression filter', async () => {
    await userMapper.insert(USERS);

    const users = await userMapper
      .select(sql`name != ${USERS[0].name}`)
      .getMany();
    expect(users.length).toEqual(1);
    expect(users[0].handle).toEqual(USERS[1].handle);
  });

  it('BUILDER: selects with a matching field filter via filter()', async () => {
    await userMapper.insert(USERS);

    let users = await userMapper
      .select()
      .filter({
        name: USERS[0].name,
      })
      .getMany();
    expect(users.length).toEqual(2);
    expect(users[0].handle).toEqual(USERS[0].handle);
    expect(users[1].handle).toEqual(USERS[2].handle);

    users = await userMapper
      .select()
      .filter({
        name: USERS[0].name,
        handle: USERS[2].handle,
      })
      .getMany();
    expect(users.length).toEqual(1);
    expect(users[0].handle).toEqual(USERS[2].handle);
  });

  it('BUILDER: selects with a binary operation filter via filter()', async () => {
    await userMapper.insert(USERS);

    // Test selecting by condition (with results)
    let users = await userMapper
      .select()
      .filter(['name', '=', USERS[0].name])
      .getMany();
    expect(users.length).toEqual(2);
    expect(users[0].handle).toEqual(USERS[0].handle);
    expect(users[1].handle).toEqual(USERS[2].handle);

    // Test selecting by condition (no results)
    users = await userMapper
      .select()
      .filter(['name', '=', 'nonexistent'])
      .getMany();
    expect(users.length).toEqual(0);
  });

  it('BUILDER: selects using select(filter).filter(filter)', async () => {
    await userMapper.insert(USERS);

    const users = await userMapper
      .select({ name: USERS[0].name })
      .filter({ handle: USERS[2].handle })
      .getMany();
    expect(users.length).toEqual(1);
    expect(users[0].handle).toEqual(USERS[2].handle);
  });

  it('BUILDER: selects many returning selected columns and aliases', async () => {
    const ids = await userMapper.insert(USERS);
    const mapper = new TableMapper(db, 'users', {
      selectedColumns: ['id', 'handle as h'],
    });

    // Should allow access to aliased columns
    (await mapper.select().getMany())[0].h;

    const users = await mapper.select({ name: USERS[0].name }).getMany();
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

    ignore('BUILDER: inaccessible types are not allowed', async () => {
      // @ts-expect-error - aliases are not allowed in filter expressions
      mapper.select({ h: USERS[0].handle });
      // @ts-expect-error - unselected columns are not allowed
      (await mapper.select().getMany())[0].name;
    });
  });

  ignore(
    'BUILDER: detects select() getMany() simple filter type errors',
    async () => {
      // @ts-expect-error - only table columns are accessible unfiltered
      (await userMapper.select().getMany())[0].notThere;
      // @ts-expect-error - only table columns are accessible unfiltered
      (await userMapper.select({}).getMany())[0].notThere;
      // @ts-expect-error - only table columns are accessible w/ object filter
      // prettier-ignore
      (await userMapper.select({ name: "Sue" }).getMany())[0].notThere;
      // @ts-expect-error - only table columns are accessible w/ op filter
      // prettier-ignore
      (await userMapper.select(["name", "=", "Sue"]).getMany())[0].notThere;
      // prettier-ignore
      (
        await userMapper
          .select((qb) => qb)
          .getMany()
        // @ts-expect-error - only table columns are accessible w/ QB filter
      )[0].notThere;
      // prettier-ignore
      (
        await userMapper
          .select(sql`name = 'Sue'`)
          .getMany()
        // @ts-expect-error - only table columns are accessible w/ expr filter
      )[0].notThere;
    }
  );
});

describe('select() getOne()', () => {
  it('BUILDER: selects the first row with no filter', async () => {
    await userMapper.insert(USERS);

    let user = await userMapper.select().getOne();
    expect(user?.handle).toEqual(USERS[0].handle);

    user = await userMapper.select({}).getOne();
    expect(user?.handle).toEqual(USERS[0].handle);
  });

  it('BUILDER: selects the first row with a matching field filter', async () => {
    await userMapper.insert(USERS);

    let user = await userMapper.select({ name: USERS[0].name }).getOne();
    expect(user?.handle).toEqual(USERS[0].handle);

    user = await userMapper
      .select({
        name: USERS[0].name,
        handle: USERS[2].handle,
      })
      .getOne();
    expect(user?.handle).toEqual(USERS[2].handle);
  });

  it('BUILDER: selects the first row with a binary operation filter', async () => {
    await userMapper.insert(USERS);

    // Test selecting by condition (with result)
    let user = await userMapper.select(['name', '=', USERS[0].name]).getOne();
    expect(user?.handle).toEqual(USERS[0].handle);

    // Test selecting by condition (no result)
    user = await userMapper.select(['name', '=', 'nonexistent']).getOne();
    expect(user).toBeNull();
  });

  it('BUILDER: selects the first row with a query expression filter', async () => {
    await userMapper.insert(USERS);

    const user = await userMapper
      .select(sql`name != ${USERS[0].name}`)
      .getOne();
    expect(user?.handle).toEqual(USERS[1].handle);
  });

  it('BUILDER: selects the first row with a compound filter', async () => {
    const userIDs = await userMapper.insert(USERS);

    const user = await userMapper
      .select(({ and, cmpr }) =>
        and([cmpr('name', '=', USERS[0].name), cmpr('id', '>', userIDs[0].id)])
      )
      .getOne();
    expect(user?.handle).toEqual(USERS[2].handle);
  });

  it('BUILDER: selects the first row with a matching field filter via filter()', async () => {
    await userMapper.insert(USERS);

    let user = await userMapper
      .select()
      .filter({ name: USERS[0].name })
      .getOne();
    expect(user?.handle).toEqual(USERS[0].handle);

    user = await userMapper
      .select({
        name: USERS[0].name,
        handle: USERS[2].handle,
      })
      .getOne();
    expect(user?.handle).toEqual(USERS[2].handle);
  });

  it('BUILDER: selects the first row with a binary operation filter via filter()', async () => {
    await userMapper.insert(USERS);

    // Test selecting by condition (with result)
    let user = await userMapper
      .select()
      .filter(['name', '=', USERS[0].name])
      .getOne();
    expect(user?.handle).toEqual(USERS[0].handle);

    // Test selecting by condition (no result)
    user = await userMapper.select(['name', '=', 'nonexistent']).getOne();
    expect(user).toBeNull();
  });

  it('BUILDER: selects one returning selected columns and aliases', async () => {
    const ids = await userMapper.insert(USERS);
    const mapper = new TableMapper(db, 'users', {
      selectedColumns: ['id', 'handle as h'],
    });

    // Should allow access to aliased columns
    (await mapper.select().getOne())!.h;

    const user = await mapper.select({ handle: USERS[0].handle }).getOne();
    expect(user).toEqual({ id: ids[0].id, h: USERS[0].handle });

    ignore('BUILDER: inaccessible types are not allowed', async () => {
      // @ts-expect-error - unselected columns are not allowed
      (await mapper.select().getMany())[0].name;
    });
  });

  ignore('detects select() getOne() type errors', async () => {
    // @ts-expect-error - only table columns are accessible unfiltered
    (await userMapper.select({}).getOne()).notThere;
    // @ts-expect-error - only table columns are accessible w/ object filter
    (await userMapper.select({ name: 'Sue' }).getOne()).notThere;
    // @ts-expect-error - only table columns are accessible w/ op filter
    // prettier-ignore
    (await userMapper.select(["name", "=", "Sue"]).getOne()).notThere;
    // prettier-ignore
    (
      await userMapper
        .select((qb) => qb)
        .getOne()
      // @ts-expect-error - only table columns are accessible w/ QB filter
    )!.notThere;
    // prettier-ignore
    (
      await userMapper
        .select(sql`name = 'Sue'`)
        .getOne()
      // @ts-expect-error - only table columns are accessible w/ expr filter
    )!.notThere;
  });
});
