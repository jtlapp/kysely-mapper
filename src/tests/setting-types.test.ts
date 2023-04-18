import { Insertable, Kysely, Selectable, Updateable } from 'kysely';

import { TableMapper } from '../mappers/table-mapper';
import { createDB, resetDB, destroyDB } from './utils/test-setup';
import { Database, Users } from './utils/test-tables';
import { ignore } from './utils/test-utils';
import { SelectionColumn } from '../lib/type-utils';

let db: Kysely<Database>;

beforeAll(async () => {
  db = await createDB();
});
beforeEach(() => resetDB(db));
afterAll(() => destroyDB(db));

describe('table mapper setting type checks', () => {
  ignore('detects invalid return column configurations', () => {
    new TableMapper<
      Database,
      'users',
      ['id']
      // @ts-expect-error - invalid return column configuration
    >(db, 'users', { returnColumns: ['notThere'] });

    new TableMapper<Database, 'users', ['id']>(db, 'users', {
      // @ts-expect-error - actual and declared return types must match
      returnColumns: ['id', 'name'],
    });

    new TableMapper<
      Database,
      'users',
      [],
      ['*'],
      Selectable<Users>,
      Insertable<Users>,
      Updateable<Users>,
      bigint,
      // @ts-expect-error - invalid return column configuration
      ['notThere']
    >(db, 'users', {});

    new TableMapper<
      Database,
      'users',
      [],
      ['*'],
      Selectable<Users>,
      Insertable<Users>,
      Updateable<Users>,
      bigint,
      // @ts-expect-error - invalid return column configuration
      ['name', 'notThere']
    >(db, 'users', {});

    new TableMapper<
      Database,
      'users',
      ['id']
      // @ts-expect-error - invalid return column configuration
    >(db, 'users', { returnColumns: [''] });

    new TableMapper<
      Database,
      'users',
      ['id']
      // @ts-expect-error - invalid return column configuration
    >(db, 'users', { returnColumns: ['notThere'] });

    class TestMapper6<
      ReturnColumns extends SelectionColumn<Database, 'users'>[] | ['*'] = []
    > extends TableMapper<
      Database,
      'users',
      [],
      ['*'],
      Selectable<Users>,
      Insertable<Users>,
      Updateable<Users>,
      number,
      ReturnColumns
    > {}
    // @ts-expect-error - invalid return column configuration
    new TestMapper6(db, 'users', { returnColumns: ['notThere'] });

    new TableMapper<
      Database,
      'users',
      [],
      any,
      any,
      any,
      any,
      number,
      ['id', 'name']
    >(db, 'users', {
      // @ts-expect-error - actual and declared return types must match
      returnColumns: ['id'],
    });

    new TableMapper<Database, 'users', [], any, any, any, any, number, ['*']>(
      db,
      'users',
      {
        // @ts-expect-error - actual and declared return types must match
        returnColumns: ['id'],
      }
    );

    new TableMapper<Database, 'users', [], any, any, any, any, number, []>(
      db,
      'users',
      {
        // @ts-expect-error - actual and declared return types must match
        returnColumns: ['id'],
      }
    );
  });

  ignore('detects invalid return count configuration', () => {
    class TestMapper extends TableMapper<
      Database,
      'users',
      ['id'],
      ['*'],
      Selectable<Users>,
      Insertable<Users>,
      Updateable<Users>,
      number
    > {}
    new TestMapper(db, 'users', {
      // @ts-expect-error - invalid return count
      countTransform: (count: bigint) => BigInt(count),
    });
  });

  it('dummy test', () => {
    // gets test to run without error
    expect(true).toBe(true);
  });
});
