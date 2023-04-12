import { Kysely } from 'kysely';

import { createDB, resetDB, destroyDB } from './utils/test-setup';
import { Database } from './utils/test-tables';
import {
  UserTableMapperReturningAll,
  UserTableMapperReturningDefault,
} from './utils/test-mappers';
import { USERS } from './utils/test-objects';
import { ignore } from './utils/test-utils';
import { TableMapper } from '../mappers/table-mapper';

let db: Kysely<Database>;
let userMapper: UserTableMapperReturningAll;

beforeAll(async () => {
  db = await createDB();
  userMapper = new UserTableMapperReturningAll(db);
});
beforeEach(() => resetDB(db));
afterAll(() => destroyDB(db));

describe('deleting rows via TableMapper', () => {
  it("doesn't delete anything if no rows match", async () => {
    const count = await userMapper.delete({ name: USERS[0].name }).getCount();
    expect(count).toEqual(0);

    const success = await userMapper.delete({ name: USERS[0].name }).run();
    expect(success).toEqual(false);
  });

  it('deletes rows without returning a count', async () => {
    const testMapper = new TableMapper(db, 'users', {
      countTransform: (count) => Number(count),
    });
    await testMapper.insert().run(USERS);

    const result = await testMapper.delete({ name: USERS[0].name }).run();
    expect(result).toBeUndefined();

    const users = await testMapper.select().getAll();
    expect(users.length).toEqual(1);
    expect(users[0].handle).toEqual(USERS[1].handle);
  });

  it('deletes rows returning the deletion count as bigint default', async () => {
    const defaultMapper = new UserTableMapperReturningDefault(db);

    const count1 = await defaultMapper
      .delete({ name: USERS[0].name })
      .getCount();
    expect(count1).toEqual(BigInt(0));

    await defaultMapper.insert().run(USERS);

    const count2 = await defaultMapper
      .delete({ name: USERS[0].name })
      .getCount();
    expect(count2).toEqual(BigInt(2));
    const users = await defaultMapper.select().getAll();
    expect(users.length).toEqual(1);
    expect(users[0].handle).toEqual(USERS[1].handle);
  });

  it('deletes rows returning the deletion count inferred as a number', async () => {
    const testMapper = new TableMapper(db, 'users', {
      countTransform: (count) => Number(count),
    });
    await testMapper.insert().run(USERS);

    const count = await testMapper.delete({ name: USERS[0].name }).getCount();
    expect(count).toEqual(2);
  });

  it('deletes rows returning the deletion count as number', async () => {
    const count1 = await userMapper.delete({ name: USERS[0].name }).getCount();
    expect(count1).toEqual(0);

    await userMapper.insert().run(USERS);

    const count2 = await userMapper.delete({ name: USERS[0].name }).getCount();
    expect(count2).toEqual(2);
    const users = await userMapper.select().getAll();
    expect(users.length).toEqual(1);
    expect(users[0].handle).toEqual(USERS[1].handle);
  });

  it('deletes all rows without a filter', async () => {
    await userMapper.insert().run(USERS);
    const count1 = await userMapper.delete().getCount();
    expect(count1).toEqual(3);
    const users1 = await userMapper.select().getAll();
    expect(users1.length).toEqual(0);

    await userMapper.insert().run(USERS);
    const success = await userMapper.delete().run();
    expect(success).toBe(true);
    const users2 = await userMapper.select().getAll();
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
      .getCount();
    expect(count1).toEqual(1);

    const count2 = await userMapper
      .delete(({ or, cmpr }) =>
        or([
          cmpr('name', '=', USERS[0].name),
          cmpr('handle', '=', USERS[0].handle),
        ])
      )
      .getCount();
    expect(count2).toEqual(1);
  });

  it('modifies a delete query builder', async () => {
    await userMapper.insert().run(USERS);
    await userMapper.insert().run({ ...USERS[1], handle: 'user4' });

    const count1 = await userMapper
      .delete()
      .modify((qb) => qb.where('name', '=', USERS[0].name))
      .getCount();
    expect(count1).toEqual(2);

    const count2 = await userMapper
      .delete({ name: USERS[1].name })
      .modify((qb) => qb.where('handle', '=', 'user4'))
      .getCount();
    expect(count2).toEqual(1);

    const users = await userMapper.select().getAll();
    expect(users.length).toEqual(1);
  });

  // it('deletes via parameterized queries', async () => {
  //   const parameterization = userMapper
  //     .delete()
  //     .parameterize<{ targetName: string }>(({ q, param }) =>
  //       q.filter({ name: param('targetName') })
  //     );

  //   const count1 = await parameterization.getCount(db, {
  //     targetName: USERS[0].name,
  //   });
  //   expect(count1).toEqual(0);

  //   await userMapper.insert().run(USERS);

  //   const count2 = await parameterization.getCount(db, {
  //     targetName: USERS[0].name,
  //   });
  //   expect(count2).toEqual(2);
  //   const users = await userMapper.select().getAll();
  //   expect(users.length).toEqual(1);
  //   expect(users[0].handle).toEqual(USERS[1].handle);

  //   const count3 = await parameterization.getCount(db, {
  //     targetName: USERS[1].name,
  //   });
  //   expect(count3).toEqual(1);
  //   const users2 = await userMapper.select().getAll();
  //   expect(users2.length).toEqual(0);

  //   ignore('parameterization type errors', () => {
  //     // @ts-expect-error - errors on invalid parameter names
  //     parameterization.run(db, { notThere: 'foo' });
  //   });
  // });

  ignore('detects deletion type errors', async () => {
    // @ts-expect-error - table must have all filter fields
    userMapper.delete({ notThere: 'xyz' });
    // @ts-expect-error - table must have all filter fields
    userMapper.delete(['notThere', '=', 'foo']);
    // @ts-expect-error - doesn't allow plain string expression filters
    userMapper.delete("name = 'John Doe'");
    userMapper.delete(({ or, cmpr }) =>
      // @ts-expect-error - only table columns are accessible via anyOf()
      or([cmpr('notThere', '=', 'xyz'), cmpr('alsoNotThere', '=', 'Sue')])
    );
    userMapper.delete(({ or, cmpr }) =>
      // @ts-expect-error - only table columns are accessible via allOf()
      or([cmpr('notThere', '=', 'xyz'), cmpr('alsoNotThere', '=', 'Sue')])
    );
  });
});
