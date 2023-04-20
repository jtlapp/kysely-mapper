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
  return new TableMapper(db, 'users', {
    keyColumns: ['id'],
    updateReturnColumns: ['id'],
  }).withTransforms({
    countTransform,
  });
}

export function createUserMapperReturningIDAndHandleAsH(db: Kysely<Database>) {
  return new TableMapper(db, 'users', {
    keyColumns: ['id'],
    insertReturnColumns: ['id', 'handle as h'],
    updateReturnColumns: ['id', 'handle as h'],
  }).withTransforms({ countTransform });
}

export function createUserMapperReturningAll(db: Kysely<Database>) {
  return new TableMapper(db, 'users', {
    insertReturnColumns: ['*'],
    updateReturnColumns: ['*'],
  }).withTransforms({
    countTransform,
  });
}

export function createInsertTransformMapper(db: Kysely<Database>) {
  return new TableMapper(db, 'users', {
    insertReturnColumns: ['id'],
    updateReturnColumns: ['id'],
  }).withTransforms({
    insertTransform: (source: InsertedUser) => ({
      name: `${source.firstName} ${source.lastName}`,
      handle: source.handle,
      email: source.email,
    }),
    countTransform: (count) => Number(count),
  });
}
