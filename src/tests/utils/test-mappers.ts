import { Kysely } from 'kysely';

import { TableMapper } from '../../mappers/table-mapper';
import { Database } from './test-tables';

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
