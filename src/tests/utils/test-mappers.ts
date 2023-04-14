import { Insertable, Kysely, Selectable } from 'kysely';

import { TableMapper } from '../../mappers/table-mapper';
import { Database, Users } from './test-tables';

const countTransform = (count: bigint) => Number(count);

export class UserTableMapperReturningDefault extends TableMapper<
  Database,
  'users'
> {
  constructor(readonly db: Kysely<Database>) {
    super(db, 'users');
  }
}

export class UserTableMapperReturningNothing extends TableMapper<
  Database,
  'users',
  [],
  ['*'],
  Selectable<Users>,
  Insertable<Users>,
  Partial<Insertable<Users>>,
  number
> {
  constructor(readonly db: Kysely<Database>) {
    super(db, 'users', { returnColumns: [], countTransform });
  }
}

export class UserTableMapperReturningID extends TableMapper<
  Database,
  'users',
  ['id'],
  ['*'],
  Selectable<Users>,
  Insertable<Users>,
  Partial<Insertable<Users>>,
  number
> {
  constructor(readonly db: Kysely<Database>) {
    super(db, 'users', { returnColumns: ['id'], countTransform });
  }
}

export class UserTableMapperReturningIDAndHandleAsH extends TableMapper<
  Database,
  'users',
  ['id'],
  ['*'],
  Selectable<Users>,
  Insertable<Users>,
  Partial<Insertable<Users>>,
  number,
  ['id', 'handle as h']
> {
  constructor(readonly db: Kysely<Database>) {
    super(db, 'users', {
      returnColumns: ['id', 'handle as h'],
      countTransform,
    });
  }
}

export class UserTableMapperReturningAll extends TableMapper<
  Database,
  'users',
  [],
  ['*'],
  Selectable<Users>,
  Insertable<Users>,
  Partial<Insertable<Users>>,
  number,
  ['*']
> {
  constructor(readonly db: Kysely<Database>) {
    super(db, 'users', { returnColumns: ['*'], countTransform });
  }
}
