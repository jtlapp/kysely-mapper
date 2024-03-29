import { Kysely, InsertQueryBuilder, InsertResult, Insertable } from 'kysely';

import { SelectionColumn } from '../lib/type-utils.js';
import { SubsettingMappingInsertQuery } from './subsetting-insert-query.js';
import { MappingInsertQuery } from './insert-query.js';
import { InsertTransforms } from '../mappers/table-mapper-transforms.js';

/**
 * Mapping query for inserting rows into a database table, where the
 * columns to be inserted have not been restricted.
 */
export class AnyColumnsMappingInsertQuery<
  DB,
  TB extends keyof DB & string,
  QB extends InsertQueryBuilder<DB, TB, InsertResult>,
  InsertedObject,
  InsertReturnColumns extends Readonly<SelectionColumn<DB, TB>[]> | ['*'],
  InsertReturn
> extends MappingInsertQuery<
  DB,
  TB,
  QB,
  InsertedObject,
  InsertReturnColumns,
  InsertReturn
> {
  constructor(
    db: Kysely<DB>,
    qb: QB,
    transforms: Readonly<
      InsertTransforms<
        DB,
        TB,
        InsertedObject,
        InsertReturnColumns,
        InsertReturn
      >
    >,
    returnColumns: Readonly<InsertReturnColumns>
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
    columnsToInsert: Readonly<(keyof Insertable<DB[TB]> & string)[]>
  ): SubsettingMappingInsertQuery<
    DB,
    TB,
    QB,
    InsertedObject,
    InsertReturnColumns,
    InsertReturn
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
