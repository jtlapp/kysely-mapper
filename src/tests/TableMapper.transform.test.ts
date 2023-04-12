import { Insertable, Kysely, Selectable } from 'kysely';

// TODO: revisit what tests are necessary here; and wht to call this file

import { TableMapper } from '../mappers/table-mapper';
import { createDB, resetDB, destroyDB } from './utils/test-setup';
import { Database, Users } from './utils/test-tables';
import { ignore } from './utils/test-utils';

let db: Kysely<Database>;

beforeAll(async () => {
  db = await createDB();
});
beforeEach(() => resetDB(db));
afterAll(() => destroyDB(db));

describe('transforms between inputs and outputs', () => {
  ignore('detects invalid return column configurations', () => {
    new TableMapper<
      Database,
      'users',
      ['*'],
      Selectable<Users>,
      Insertable<Users>,
      Partial<Insertable<Users>>,
      ['id'],
      number
      // @ts-expect-error - invalid return column configuration
    >(db, 'users', { returnColumns: ['notThere'] });

    new TableMapper<
      Database,
      'users',
      ['*'],
      Selectable<Users>,
      Insertable<Users>,
      Partial<Insertable<Users>>,
      // @ts-expect-error - invalid return column configuration
      ['notThere'],
      number
    >(db, 'users', {});

    new TableMapper<
      Database,
      'users',
      ['*'],
      Selectable<Users>,
      Insertable<Users>,
      Partial<Insertable<Users>>,
      // @ts-expect-error - invalid return column configuration
      ['name', 'notThere'],
      number
    >(db, 'users', {});

    new TableMapper<
      Database,
      'users',
      ['*'],
      Selectable<Users>,
      Insertable<Users>,
      Partial<Insertable<Users>>,
      ['id'],
      number
      // @ts-expect-error - invalid return column configuration
    >(db, 'users', { returnColumns: [''] });

    new TableMapper<
      Database,
      'users',
      ['*'],
      Selectable<Users>,
      Insertable<Users>,
      Partial<Insertable<Users>>,
      ['id']
      // @ts-expect-error - invalid return column configuration
    >(db, 'users', { returnColumns: ['notThere'] });

    class TestMapper6<
      // Be sure the following is the same as in TableMapper
      ReturnColumns extends (keyof Selectable<Users> & string)[] = []
    > extends TableMapper<
      Database,
      'users',
      ['*'],
      Selectable<Users>,
      Insertable<Users>,
      Partial<Insertable<Users>>,
      ReturnColumns,
      number
    > {}
    // @ts-expect-error - invalid return column configuration
    new TestMapper6(db, 'users', { returnColumns: ['notThere'] });
  });

  it('dummy test', () => {
    // gets test to run without error
    expect(true).toBe(true);
  });
});
