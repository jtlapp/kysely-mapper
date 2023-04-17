import { Kysely, InsertQueryBuilder, InsertResult, Insertable } from 'kysely';

import { SelectionColumn } from '../lib/type-utils';
import { SubsettingMappingInsertQuery } from './subsetting-insert-query';
import { MappingInsertQuery } from './insert-query';
import { InsertTransforms } from '../mappers/table-mapper-transforms';

/**
 * Mapping query for inserting rows into a database table, where the
 * columns to be inserted have not been restricted.
 */
export class AnyColumnsMappingInsertQuery<
  DB,
  TB extends keyof DB & string,
  QB extends InsertQueryBuilder<DB, TB, InsertResult>,
  InsertedObject extends object,
  SelectedObject extends object,
  ReturnColumns extends SelectionColumn<DB, TB>[] | ['*'],
  InsertReturnsSelectedObject extends boolean,
  DefaultReturnObject extends object
> extends MappingInsertQuery<
  DB,
  TB,
  QB,
  InsertedObject,
  SelectedObject,
  ReturnColumns,
  InsertReturnsSelectedObject,
  DefaultReturnObject
> {
  constructor(
    db: Kysely<DB>,
    qb: QB,
    transforms: InsertTransforms<
      DB,
      TB,
      SelectedObject,
      InsertedObject,
      ReturnColumns,
      InsertReturnsSelectedObject,
      DefaultReturnObject
    >,
    returnColumns?: ReturnColumns
  ) {
    super(db, qb, transforms, returnColumns);
  }

  /**
   * Returns a mapping query that only inserts a specified subset of columns.
   * @param columns The columns to insert. All are required, but this
   *  constraint is only enforced at runtime, not by the type system.
   * @returns A mapping query that only inserts the specified columns.
   */
  columns(
    columnsToInsert: (keyof Insertable<DB[TB]> & string)[]
  ): SubsettingMappingInsertQuery<
    DB,
    TB,
    QB,
    InsertedObject,
    SelectedObject,
    ReturnColumns,
    InsertReturnsSelectedObject,
    DefaultReturnObject
  > {
    return new SubsettingMappingInsertQuery(
      this.db,
      this.qb,
      columnsToInsert,
      this.transforms,
      this.returnColumns
    );
  }
}
