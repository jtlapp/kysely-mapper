import { Kysely } from 'kysely';

import { createDB, resetDB, destroyDB } from './utils/test-setup';
import { Database } from './utils/test-tables';
import {
  createUserMapperReturningAll,
  createUserMapperReturningDefault,
  createUserMapperReturningNothing,
} from './utils/test-mappers';
import { USERS } from './utils/test-objects';
import { ignore } from './utils/test-utils';
import { TableMapper } from '../mappers/table-mapper';

let db: Kysely<Database>;
let userMapper: ReturnType<typeof createUserMapperReturningAll>;
let userMapperReturningNothing: ReturnType<
  typeof createUserMapperReturningNothing
>;

beforeAll(async () => {
  db = await createDB();
  userMapper = createUserMapperReturningAll(db);
  userMapperReturningNothing = createUserMapperReturningNothing(db);
});
beforeEach(() => resetDB(db));
afterAll(() => destroyDB(db));

describe('deleting rows via TableMapper', () => {
  it('accepts readonly filters', async () => {
    const filter = { name: 'Not There' as const } as const;
    await userMapper.delete(filter).run();
    await userMapper.delete(filter).returnCount();
  });

  it("doesn't delete anything if no rows match", async () => {
    const count = await userMapper
      .delete({ name: USERS[0].name })
      .returnCount();
    expect(count).toEqual(0);

    const success = await userMapper.delete({ name: USERS[0].name }).run();
    expect(success).toEqual(false);
  });

  it('deletes rows without returning a count', async () => {
    const testMapper = new TableMapper(db, 'users').withTransforms({
      countTransform: (count) => Number(count),
    });
    await testMapper.insert().run(USERS);

    const success = await testMapper.delete({ name: USERS[0].name }).run();
    expect(success).toBe(true);

    const users = await testMapper.select().returnAll();
    expect(users.length).toEqual(1);
    expect(users[0].handle).toEqual(USERS[1].handle);
  });

  it('deletes rows returning the deletion count as bigint default', async () => {
    const defaultMapper = createUserMapperReturningDefault(db);

    const count1 = await defaultMapper
      .delete({ name: USERS[0].name })
      .returnCount();
    expect(count1).toEqual(BigInt(0));

    await defaultMapper.insert().run(USERS);

    const count2 = await defaultMapper
      .delete({ name: USERS[0].name })
      .returnCount();
    expect(count2).toEqual(BigInt(2));
    const users = await defaultMapper.select().returnAll();
    expect(users.length).toEqual(1);
    expect(users[0].handle).toEqual(USERS[1].handle);
  });

  it('deletes rows returning the deletion count inferred as a number', async () => {
    const testMapper = new TableMapper(db, 'users').withTransforms({
      countTransform: (count) => Number(count),
    });
    await testMapper.insert().run(USERS);

    const count = await testMapper
      .delete({ name: USERS[0].name })
      .returnCount();
    expect(count).toEqual(2);
  });

  it('deletes rows returning the deletion count as number', async () => {
    const count1 = await userMapper
      .delete({ name: USERS[0].name })
      .returnCount();
    expect(count1).toEqual(0);

    await userMapper.insert().run(USERS);

    const count2 = await userMapper
      .delete({ name: USERS[0].name })
      .returnCount();
    expect(count2).toEqual(2);
    const users = await userMapper.select().returnAll();
    expect(users.length).toEqual(1);
    expect(users[0].handle).toEqual(USERS[1].handle);
  });

  it('deletes all rows without a filter', async () => {
    await userMapper.insert().run(USERS);
    const count1 = await userMapper.delete().returnCount();
    expect(count1).toEqual(3);
    const users1 = await userMapper.select().returnAll();
    expect(users1.length).toEqual(0);

    await userMapper.insert().run(USERS);
    const success = await userMapper.delete().run();
    expect(success).toBe(true);
    const users2 = await userMapper.select().returnAll();
    expect(users2.length).toEqual(0);
  });

  it('deletes rows specified via compound filter', async () => {
    await userMapper.insert().run(USERS);

    const count1 = await userMapper
      .delete(({ and, cmpr }) =>
        and([
          cmpr('name', '=', USERS[0].name),
          cmpr('handle', '=', USERS[0].handle),
        ])
      )
      .returnCount();
    expect(count1).toEqual(1);

    const count2 = await userMapper
      .delete(({ or, cmpr }) =>
        or([
          cmpr('name', '=', USERS[0].name),
          cmpr('handle', '=', USERS[0].handle),
        ])
      )
      .returnCount();
    expect(count2).toEqual(1);
  });

  it('deletes rows specified via binary operation', async () => {
    await userMapper.insert().run(USERS);

    const count1 = await userMapper
      .delete('name', '=', USERS[0].name)
      .returnCount();
    expect(count1).toEqual(2);

    const users = await userMapper.select().returnAll();
    expect(users.length).toEqual(1);
    expect(users[0].handle).toEqual(USERS[1].handle);
  });

  it('modifies a delete query builder', async () => {
    await userMapper.insert().run(USERS);
    await userMapper.insert().run({ ...USERS[1], handle: 'user4' });

    const count1 = await userMapper
      .delete()
      .modify((qb) => qb.where('name', '=', USERS[0].name))
      .returnCount();
    expect(count1).toEqual(2);

    const count2 = await userMapper
      .delete({ name: USERS[1].name })
      .modify((qb) => qb.where('handle', '=', 'user4'))
      .returnCount();
    expect(count2).toEqual(1);

    const users = await userMapper.select().returnAll();
    expect(users.length).toEqual(1);
  });

  it('compiles an unparameterized delete query', async () => {
    await userMapper.insert().run(USERS);

    const compilation = userMapper.delete({ name: USERS[0].name }).compile();
    const count1 = await compilation.returnCount({});
    expect(count1).toEqual(2);
    const users = await userMapper.select().returnAll();
    expect(users.length).toEqual(1);
    expect(users[0].handle).toEqual(USERS[1].handle);

    await userMapper.insert().run(USERS[2]);

    const success = await compilation.run({});
    expect(success).toBe(true);
    const users2 = await userMapper.select().returnAll();
    expect(users2.length).toEqual(1);
    expect(users2[0].handle).toEqual(USERS[1].handle);
  });

  it('parameterizes and compiles a delete query', async () => {
    const parameterization = userMapper.parameterize<{ targetName: string }>(
      ({ mapper, param }) => mapper.delete({ name: param('targetName') })
    );

    const count1 = await parameterization.returnCount({
      targetName: USERS[0].name,
    });
    expect(count1).toEqual(0);

    await userMapper.insert().run(USERS);

    const count2 = await parameterization.returnCount({
      targetName: USERS[0].name,
    });
    expect(count2).toEqual(2);
    const users = await userMapper.select().returnAll();
    expect(users.length).toEqual(1);
    expect(users[0].handle).toEqual(USERS[1].handle);

    const count3 = await parameterization.returnCount({
      targetName: USERS[1].name,
    });
    expect(count3).toEqual(1);
    const users2 = await userMapper.select().returnAll();
    expect(users2.length).toEqual(0);

    ignore('parameterization type errors', () => {
      // @ts-expect-error - errors on invalid parameter names
      parameterization.run({ notThere: 'foo' });
      userMapper.parameterize<{ name: string }>(
        // @ts-expect-error - errors on invalid parameter name
        ({ mapper, param }) => mapper.select({ name: param('notThere') })
      );
      userMapper.parameterize<{ name: number }>(
        // @ts-expect-error - errors on invalid parameter type
        ({ mapper, param }) => mapper.select({ name: param('name') })
      );
      // @ts-expect-error - errors on invalid parameter value name
      parameterization.run({ notThere: 'foo' });
      // @ts-expect-error - errors on invalid parameter value type
      parameterization.run({ targetName: 123 });
    });
  });

  ignore('detects deletion type errors', async () => {
    // @ts-expect-error - table must have all filter fields
    userMapper.delete({ notThere: 'xyz' });
    // @ts-expect-error - table must have all filter fields
    userMapper.delete('notThere', '=', 'foo');
    userMapper.delete(({ or, cmpr }) =>
      // @ts-expect-error - only table columns are accessible via anyOf()
      or([cmpr('notThere', '=', 'xyz'), cmpr('alsoNotThere', '=', 'Sue')])
    );
    userMapper.delete(({ or, cmpr }) =>
      // @ts-expect-error - only table columns are accessible via allOf()
      or([cmpr('notThere', '=', 'xyz'), cmpr('alsoNotThere', '=', 'Sue')])
    );
    // @ts-expect-error - ID filter must have correct type
    userMapper.delete('str');
    // @ts-expect-error - ID filter must have correct type
    userMapper.delete(['str']);
    // @ts-expect-error - ID filter not allowed when when no ID column
    userMapperReturningNothing.delete(1);
    // @ts-expect-error - ID filter not allowed when when no ID column
    userMapperReturningNothing.delete([1]);
  });
});
