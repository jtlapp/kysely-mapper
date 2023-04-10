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
  ['*'],
  Selectable<Users>,
  Insertable<Users>,
  Partial<Insertable<Users>>,
  [],
  number
> {
  constructor(readonly db: Kysely<Database>) {
    super(db, 'users', { returnColumns: [], countTransform });
  }
}

export class UserTableMapperReturningID extends TableMapper<
  Database,
  'users',
  ['*'],
  Selectable<Users>,
  Insertable<Users>,
  Partial<Insertable<Users>>,
  ['id'],
  number
> {
  constructor(readonly db: Kysely<Database>) {
    super(db, 'users', { returnColumns: ['id'], countTransform });
  }
}

export class UserTableMapperReturningIDAndHandle extends TableMapper<
  Database,
  'users',
  ['*'],
  Selectable<Users>,
  Insertable<Users>,
  Partial<Insertable<Users>>,
  ['id', 'handle'],
  number
> {
  constructor(readonly db: Kysely<Database>) {
    super(db, 'users', { returnColumns: ['id', 'handle'], countTransform });
  }
}

export class UserTableMapperReturningAll extends TableMapper<
  Database,
  'users',
  ['*'],
  Selectable<Users>,
  Insertable<Users>,
  Partial<Insertable<Users>>,
  ['*'],
  number
> {
  constructor(readonly db: Kysely<Database>) {
    super(db, 'users', { returnColumns: ['*'], countTransform });
  }
}
