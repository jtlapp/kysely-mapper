/**
 * Tests TableMapper.selectMany(), TableMapper.selectOne(), and query filters.
 */

import { Kysely, sql } from 'kysely';

import { TableMapper } from '../mappers/table-mapper';
import { createDB, resetDB, destroyDB } from './utils/test-setup';
import { Database } from './utils/test-tables';
import { createUserMapperReturningID } from './utils/test-mappers';
import { USERS } from './utils/test-objects';
import { ignore } from './utils/test-utils';

// TODO: what tests can I drop for now being redundant?

let db: Kysely<Database>;
let userMapper: ReturnType<typeof createUserMapperReturningID>;

beforeAll(async () => {
  db = await createDB();
  userMapper = createUserMapperReturningID(db);
});
beforeEach(() => resetDB(db));
afterAll(() => destroyDB(db));

describe('selecting all returns', () => {
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

    users = await userMapper
      .select({
        handle: [USERS[1].handle, USERS[2].handle],
      })
      .returnAll();
    expect(users.length).toEqual(2);
    expect(users[0].handle).toEqual(USERS[1].handle);
    expect(users[1].handle).toEqual(USERS[2].handle);
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

  ignore(
    'detects selecting returnAll() simple filter type errors',
    async () => {
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
    }
  );
});
