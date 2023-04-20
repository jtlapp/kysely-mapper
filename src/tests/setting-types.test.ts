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
  ignore('detects invalid return columns configurations', () => {
    new TableMapper<Database, 'users', ['id']>(db, 'users', {
      // @ts-expect-error - invalid return column configuration
      insertReturnColumns: ['notThere'],
      // @ts-expect-error - invalid return column configuration
      updateReturnColumns: ['notThere'],
    });

    new TableMapper<Database, 'users', ['id']>(db, 'users', {
      // @ts-expect-error - actual and declared return types must match
      insertReturnColumns: ['id', 'name'],
      // @ts-expect-error - actual and declared return types must match
      updateReturnColumns: ['id', 'name'],
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
      ['name'],
      // @ts-expect-error - invalid return column configuration
      ['name', 'notThere']
    >(db, 'users', {});

    new TableMapper<Database, 'users', ['id']>(db, 'users', {
      // @ts-expect-error - invalid return column configuration
      insertReturnColumns: [''],
      // @ts-expect-error - invalid return column configuration
      updateReturnColumns: [''],
    });

    new TableMapper<Database, 'users', ['id']>(db, 'users', {
      // @ts-expect-error - invalid return column configuration
      insertReturnColumns: ['notThere'],
      // @ts-expect-error - invalid return column configuration
      updateReturnColumns: ['notThere'],
    });

    class TestMapper6<
      InsertReturnColumns extends
        | SelectionColumn<Database, 'users'>[]
        | ['*'] = [],
      UpdateReturnColumns extends
        | SelectionColumn<Database, 'users'>[]
        | ['*'] = []
    > extends TableMapper<
      Database,
      'users',
      [],
      ['*'],
      Selectable<Users>,
      Insertable<Users>,
      Updateable<Users>,
      number,
      InsertReturnColumns,
      UpdateReturnColumns
    > {}
    new TestMapper6(db, 'users', {
      // @ts-expect-error - invalid return column configuration
      insertReturnColumns: ['notThere'],
      // @ts-expect-error - invalid return column configuration
      updateReturnColumns: ['notThere'],
    });

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
      insertReturnColumns: ['id'],
      // @ts-expect-error - actual and declared return types must match
      updateReturnColumns: ['id'],
    });

    new TableMapper<
      Database,
      'users',
      [],
      any,
      any,
      any,
      any,
      number,
      ['*'],
      ['*']
    >(db, 'users', {
      // @ts-expect-error - actual and declared return types must match
      insertReturnColumns: ['id'],
      // @ts-expect-error - actual and declared return types must match
      updateReturnColumns: ['id'],
    });

    new TableMapper<Database, 'users', [], any, any, any, any, number, [], []>(
      db,
      'users',
      {
        // @ts-expect-error - actual and declared return types must match
        insertReturnColumns: ['id'],
        // @ts-expect-error - actual and declared return types must match
        updateReturnColumns: ['id'],
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

  it('accepts readonly KeyColumns', () => {
    new TableMapper<
      Database,
      'users',
      Readonly<['id']> // should not error
    >(db, 'users', {});
  });

  it('accepts readonly SelectedColumns', () => {
    new TableMapper<
      Database,
      'users',
      ['id'],
      Readonly<['id', 'name']> // should not error
    >(db, 'users', {});
  });

  it('accepts readonly return columns', () => {
    new TableMapper<
      Database,
      'users',
      ['id'],
      ['*'],
      Selectable<Users>,
      Insertable<Users>,
      Updateable<Users>,
      bigint,
      Readonly<['id']>, // should not error
      Readonly<['name']> // should not error
    >(db, 'users', {});
  });

  it('accepts readonly settings', () => {
    const settings = {
      insertReturnColumns: ['id'] as const,
      updateReturnColumns: ['name'] as const,
    } as const;
    new TableMapper(db, 'users', settings);
  });
});
