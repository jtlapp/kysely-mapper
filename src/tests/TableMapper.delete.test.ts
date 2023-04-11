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

describe('BUILDER: deleting rows via TableMapper', () => {
  it('BUILDER: deleteQB() serves as a basis for deleting rows', async () => {
    await userMapper.insert(USERS[1]);

    const readUser1 = await userMapper
      .select()
      .filter({ handle: USERS[1].handle })
      .getOne();
    expect(readUser1?.handle).toEqual(USERS[1].handle);
    expect(readUser1?.email).toEqual(USERS[1].email);

    const result = await userMapper
      .deleteQB()
      .where('handle', '=', USERS[1].handle)
      .executeTakeFirst();
    expect(Number(result.numDeletedRows)).toEqual(1);

    const readUser2 = await userMapper
      .select()
      .filter({ handle: USERS[1].handle })
      .getOne();
    expect(readUser2).toBeNull();
  });

  it('BUILDER: deletes rows without returning a count', async () => {
    const testMapper = new TableMapper(db, 'users', {
      countTransform: (count) => Number(count),
    });
    await testMapper.insert(USERS);

    const result = await testMapper.delete({ name: USERS[0].name }).run();
    expect(result).toBeUndefined();

    const users = await testMapper.select().getMany();
    expect(users.length).toEqual(1);
    expect(users[0].handle).toEqual(USERS[1].handle);
  });

  it('BUILDER: deletes rows returning the deletion count as bigint default', async () => {
    const defaultMapper = new UserTableMapperReturningDefault(db);

    const count1 = await defaultMapper
      .delete({ name: USERS[0].name })
      .getCount();
    expect(count1).toEqual(BigInt(0));

    await defaultMapper.insert(USERS);

    const count2 = await defaultMapper
      .delete({ name: USERS[0].name })
      .getCount();
    expect(count2).toEqual(BigInt(2));
    const users = await defaultMapper.select().getMany();
    expect(users.length).toEqual(1);
    expect(users[0].handle).toEqual(USERS[1].handle);
  });

  it('BUILDER: deletes rows returning the deletion count inferred as a number', async () => {
    const testMapper = new TableMapper(db, 'users', {
      countTransform: (count) => Number(count),
    });
    await testMapper.insert(USERS);

    const count = await testMapper.delete({ name: USERS[0].name }).getCount();
    expect(count).toEqual(2);
  });

  it('BUILDER: deletes rows returning the deletion count as number', async () => {
    const count1 = await userMapper.delete({ name: USERS[0].name }).getCount();
    expect(count1).toEqual(0);

    await userMapper.insert(USERS);

    const count2 = await userMapper.delete({ name: USERS[0].name }).getCount();
    expect(count2).toEqual(2);
    const users = await userMapper.select().getMany();
    expect(users.length).toEqual(1);
    expect(users[0].handle).toEqual(USERS[1].handle);
  });

  it('BUILDER: deletes all rows without a filter', async () => {
    await userMapper.insert(USERS);

    const count = await userMapper.delete().getCount();
    expect(count).toEqual(3);

    const users = await userMapper.select().getMany();
    expect(users.length).toEqual(0);
  });

  it('BUILDER: deletes rows specified via compound filter', async () => {
    await userMapper.insert(USERS);

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

  // it('BUILDER: deletes via parameterized queries', async () => {
  //   const parameterization = userMapper
  //     .delete()
  //     .parameterize<{ targetName: string }>(({ q, param }) =>
  //       q.filter({ name: param('targetName') })
  //     );

  //   const count1 = await parameterization.getCount(db, {
  //     targetName: USERS[0].name,
  //   });
  //   expect(count1).toEqual(0);

  //   await userMapper.insert(USERS);

  //   const count2 = await parameterization.getCount(db, {
  //     targetName: USERS[0].name,
  //   });
  //   expect(count2).toEqual(2);
  //   const users = await userMapper.select().getMany();
  //   expect(users.length).toEqual(1);
  //   expect(users[0].handle).toEqual(USERS[1].handle);

  //   const count3 = await parameterization.getCount(db, {
  //     targetName: USERS[1].name,
  //   });
  //   expect(count3).toEqual(1);
  //   const users2 = await userMapper.select().getMany();
  //   expect(users2.length).toEqual(0);

  //   ignore('BUILDER: parameterization type errors', () => {
  //     // @ts-expect-error - errors on invalid parameter names
  //     parameterization.run(db, { notThere: 'foo' });
  //   });
  // });

  ignore('BUILDER: detects deletion type errors', async () => {
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
