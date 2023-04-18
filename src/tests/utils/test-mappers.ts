import { Kysely, Updateable } from 'kysely';

import { TableMapper } from '../../mappers/table-mapper';
import { Database } from './test-tables';
import { SelectedUser } from './test-types';

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

export function createVariableReturnTypeMapper<
  InsertReturnsSelectedObject extends boolean
>(
  db: Kysely<Database>,
  insertReturnsSelectedObject: InsertReturnsSelectedObject
) {
  return new TableMapper(db, 'users', {
    returnColumns: ['id', 'handle'],
    insertReturnsSelectedObject,
    // Hardcoded true to prevent inferencing when insertReturnsSelectedObject is false
    updateReturnsSelectedObjectWhenProvided: true,
  }).withTransforms({
    insertReturnTransform: (source, results) => {
      const names = source.name.split(' ');
      return SelectedUser.create(results.id, {
        firstName: names[0],
        lastName: names[1],
        handle: results.handle,
        email: source.email || null,
      });
    },
    selectTransform: (row) => {
      const names = row.name.split(' ');
      return SelectedUser.create(row.id, {
        firstName: names[0],
        lastName: names[1],
        handle: row.handle,
        email: row.email,
      });
    },
    updateTransform: (source: SelectedUser | Updateable<Database['users']>) => {
      if (source instanceof SelectedUser) {
        return {
          name: `${source.firstName} ${source.lastName}`,
          handle: source.handle,
          email: source.email,
        };
      }
      return source;
    },
    updateReturnTransform: (
      source: SelectedUser | Updateable<Database['users']>,
      returns
    ) => {
      if (source instanceof SelectedUser) {
        return new SelectedUser(
          returns.id,
          source.firstName,
          source.lastName,
          returns.handle,
          source.email
        );
      }
      return returns;
    },
  });
}
