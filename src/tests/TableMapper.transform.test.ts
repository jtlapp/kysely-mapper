import { Insertable, Kysely, Selectable } from 'kysely';

// TODO: revisit what tests are necessary here

import { TableMapper } from '../mappers/table-mapper';
import { createDB, resetDB, destroyDB } from './utils/test-setup';
import { Database, Users } from './utils/test-tables';
import {
  STANDARD_OPTIONS,
  selectedUser1,
  selectedUser2,
  selectedUser3,
  userRow1,
  userRow2,
  userRow3,
} from './utils/test-objects';
import {
  SelectedUser,
  InsertedUser,
  UpdaterUser,
  ReturnedUser,
} from './utils/test-types';
import { ignore } from './utils/test-utils';
import { UserTableMapperReturningID } from './utils/test-mappers';

let db: Kysely<Database>;
let userMapper: UserTableMapperReturningID;

beforeAll(async () => {
  db = await createDB();
  userMapper = new UserTableMapperReturningID(db);
});
beforeEach(() => resetDB(db));
afterAll(() => destroyDB(db));

describe('transforms between inputs and outputs', () => {
  class TestPassThruMapper extends TableMapper<Database, 'users'> {
    constructor(db: Kysely<Database>) {
      super(db, 'users');
    }

    testTransformSelection() {
      const user1 = { id: 1, ...userRow1 };
      const user2 = { id: 2, ...userRow2 };

      expect(this.rowConverter.transformRow(user1)).toEqual(user1);
      expect(this.rowConverter.transformRows([user1, user2])).toEqual([
        user1,
        user2,
      ]);
    }
  }

  class TestTransformMapper extends TableMapper<
    Database,
    'users',
    ['*'],
    SelectedUser,
    InsertedUser,
    UpdaterUser,
    ['id'],
    number,
    ReturnedUser
  > {
    constructor(db: Kysely<Database>) {
      super(db, 'users', STANDARD_OPTIONS);
    }

    testTransformSelection() {
      expect(this.rowConverter.transformRow({ id: 1, ...userRow1 })).toEqual(
        selectedUser1
      );

      expect(
        this.rowConverter.transformRows([
          { id: 1, ...userRow1 },
          { id: 2, ...userRow2 },
        ])
      ).toEqual([selectedUser1, selectedUser2]);

      ignore('detects transformSelection type errors', () => {
        const userObject = {
          id: 1,
          ...userRow1,
        };

        // @ts-expect-error - incorrect output type
        this.transformSelection(userObject).name;
        // @ts-expect-error - incorrect output type
        this.transformSelection([userObject])[0].name;
      });
    }
  }

  it('internally transforms selections', () => {
    const testPassThruMapper = new TestPassThruMapper(db);
    testPassThruMapper.testTransformSelection();

    const testTransformMapper = new TestTransformMapper(db);
    testTransformMapper.testTransformSelection();
  });

  it('transforms selected single-table objects', async () => {
    const testTransformMapper = new TestTransformMapper(db);

    await userMapper.insert().run(userRow1);
    const user = await testTransformMapper.select().getOne();
    expect(user).toEqual(selectedUser1);

    await userMapper.insert().run([userRow2, userRow3]);
    const users = await testTransformMapper
      .select()
      .modify((qb) => qb.orderBy('id'))
      .getMany();
    expect(users).toEqual([selectedUser1, selectedUser2, selectedUser3]);
  });

  ignore('detects selected object type errors', async () => {
    const testTransformMapper = new TestTransformMapper(db);

    // @ts-expect-error - only returns transformed selection
    (await testTransformMapper.selectOne({})).name;
  });
});

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
