import { Kysely } from 'kysely';

import { TableMapper } from '../../mappers/table-mapper';
import { Database } from './test-tables';
import { InsertedUser } from './test-types';

const countTransform = (count: bigint) => Number(count);

export function createUserMapperReturningDefault(db: Kysely<Database>) {
  return new TableMapper(db, 'users');
}

export function createUserMapperReturningNothing(db: Kysely<Database>) {
  return new TableMapper(db, 'users', { keyColumns: [] }).withTransforms({
    countTransform,
  });
}

export function createUserMapperReturningID(db: Kysely<Database>) {
  return new TableMapper(db, 'users', { keyColumns: ['id'] }).withTransforms({
    countTransform,
  });
}

export function createUserMapperReturningIDAndHandleAsH(db: Kysely<Database>) {
  return new TableMapper(db, 'users', {
    keyColumns: ['id'],
    returnColumns: ['id', 'handle as h'],
  }).withTransforms({ countTransform });
}

export function createUserMapperReturningAll(db: Kysely<Database>) {
  return new TableMapper(db, 'users', { returnColumns: ['*'] }).withTransforms({
    countTransform,
  });
}

export function createInsertTransformMapper(db: Kysely<Database>) {
  return new TableMapper(db, 'users', {
    returnColumns: ['id'],
  }).withTransforms({
    insertTransform: (source: InsertedUser) => ({
      name: `${source.firstName} ${source.lastName}`,
      handle: source.handle,
      email: source.email,
    }),
    countTransform: (count) => Number(count),
  });
}
