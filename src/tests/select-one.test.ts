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

describe('select one return', () => {
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

    user = await userMapper
      .select({
        id: [1, 2],
        handle: [USERS[1].handle, USERS[2].handle],
      })
      .returnOne();
    expect(user?.handle).toEqual(USERS[1].handle);
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
