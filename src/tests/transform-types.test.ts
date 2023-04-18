import { Insertable, Kysely, Selectable, Updateable } from 'kysely';

import { TableMapper } from '../mappers/table-mapper';
import { createDB, resetDB, destroyDB } from './utils/test-setup';
import { Database, Users } from './utils/test-tables';
import { User } from './utils/test-types';
import { ignore } from './utils/test-utils';
import { createInsertTransformMapper } from './utils/test-mappers';

let db: Kysely<Database>;

beforeAll(async () => {
  db = await createDB();
});
beforeEach(() => resetDB(db));
afterAll(() => destroyDB(db));

describe('table mapper transform type checks', () => {
  ignore('detects invalid select transform configuration', () => {
    class TestMapper extends TableMapper<Database, 'users', [], ['*'], User> {}
    // @ts-expect-error - invalid select transform
    new TestMapper(db, 'users', { selectTransform: (user) => user });
  });

  ignore('detects invalid insert transform configuration', () => {
    class TestMapper extends TableMapper<
      Database,
      'users',
      ['id'],
      ['*'],
      Selectable<Users>,
      User
    > {}
    // @ts-expect-error - invalid insert transform
    new TestMapper(db, 'users', { insertTransform: (user) => user });
  });

  ignore('detects invalid insert return transform configurations', () => {
    class TestMapper<
      InsertReturnsSelectedObject extends boolean
    > extends TableMapper<
      Database,
      'users',
      ['id'],
      ['*'],
      Selectable<Users>,
      User,
      Updateable<Users>,
      bigint,
      ['id'],
      InsertReturnsSelectedObject
    > {}
    new TestMapper<false>(db, 'users', {
      // @ts-expect-error - invalid insert return transform
      insertReturnTransform: (_user) => ({ noId: 1 }),
    });
    new TestMapper<true>(db, 'users', {
      // @ts-expect-error - invalid insert return transform
      insertReturnTransform: (user) => user,
    });
  });

  ignore('detects invalid update transform configuration', () => {
    class TestMapper extends TableMapper<
      Database,
      'users',
      ['id'],
      ['*'],
      Selectable<Users>,
      Insertable<Users>,
      User,
      bigint,
      ['id']
    > {}
    new TestMapper(db, 'users', {
      // @ts-expect-error - invalid update transform
      updateTransform: (_user) => ({ noId: 1 }),
    });
  });

  ignore('detects invalid update return transform configurations', async () => {
    class TestMapper<
      UpdateReturnsSelectedObjectWhenProvided extends boolean
    > extends TableMapper<
      Database,
      'users',
      ['id'],
      ['*'],
      User,
      Insertable<Users>,
      User | Updateable<Users>,
      bigint,
      ['id'],
      false,
      UpdateReturnsSelectedObjectWhenProvided
    > {}
    new TestMapper<false>(db, 'users', {
      // @ts-expect-error - invalid update return transform
      updateReturnTransform: (_user) => ({ noId: 1 }),
    });
    new TestMapper<true>(db, 'users', {
      // @ts-expect-error - invalid update return transform
      updateReturnTransform: (_user) => ({ noId: 1 }),
    });
    const testMapper = new TestMapper<true>(db, 'users');
    (await testMapper
      .update({ id: 1 })
      // @ts-expect-error - ensure that return type is User
      .returnOne(new User(1, 'John', 'Doe', 'jdoe', 'jdoe@abc.def')))!.name;
  });

  ignore('detects insertion transformation type errors', async () => {
    const insertTransformMapper = createInsertTransformMapper(db);

    // @ts-expect-error - requires InsertedObject as input
    await insertTransformMapper.insert().returnOne(USERS[0]);
    // @ts-expect-error - requires InsertedObject as input
    await insertTransformMapper.insert().run(USERS[0]);
    // @ts-expect-error - requires InsertedObject as input
    await insertTransformMapper.insert().returnOne(selectedUser1);
    // @ts-expect-error - requires InsertedObject as input
    await insertTransformMapper.insert().run(selectedUser1);
  });

  it('dummy test', () => {
    // gets test to run without error
    expect(true).toBe(true);
  });
});
