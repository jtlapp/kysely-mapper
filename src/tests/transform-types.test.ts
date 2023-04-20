import { Kysely } from 'kysely';

import { TableMapper } from '../mappers/table-mapper';
import { createDB, resetDB, destroyDB } from './utils/test-setup';
import { Database } from './utils/test-tables';
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
    new TableMapper(db, 'users').withTransforms({
      // @ts-expect-error - invalid select transform
      selectTransform: (user: User) => user,
    });
  });

  ignore('detects invalid insert transform configuration', () => {
    new TableMapper(db, 'users').withTransforms({
      // @ts-expect-error - invalid insert transform
      insertTransform: (user: User) => user,
    });
  });

  ignore('detects invalid update transform configuration', () => {
    new TableMapper(db, 'users').withTransforms({
      // @ts-expect-error - invalid update transform
      updateTransform: (_user) => ({ noId: 1 }),
    });
  });

  ignore('detects invalid update return transform return', async () => {
    const mapper = new TableMapper(db, 'users', { keyColumns: ['id'] });

    mapper.withTransforms({
      selectTransform: (_user) => new User(1, 'John', 'Doe', 'jdoe', 'x@y.z'),
      updateTransform: (user: User) => ({
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        handle: user.handle,
        email: user.email,
      }),
      updateReturnTransform: (_user, returns) => returns,
    });
    (await mapper
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

  it('accepts readonly transforms', () => {
    const transforms = {
      countTransform: (count: bigint) => count,
    } as const;

    new TableMapper(db, 'users', {}).withTransforms(transforms);
  });
});
