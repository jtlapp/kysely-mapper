import { Kysely, InsertQueryBuilder, InsertResult, Insertable } from 'kysely';

import { SelectionColumn } from '../lib/type-utils.js';
import { MappingInsertQuery } from './insert-query.js';
import { CompilingMappingInsertQuery } from './compiling-insert-query.js';
import { InsertTransforms } from '../mappers/table-mapper-transforms.js';
import { restrictValues } from '../lib/restrict-values.js';

/**
 * Mapping query for inserting rows into a database table,
 * inserting a specified subset of the insertable columns.
 */
export class SubsettingMappingInsertQuery<
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
    protected readonly columnsToInsert: Readonly<
      (keyof Insertable<DB[TB]> & string)[]
    >,
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
   * Returns a compiling query that can be executed multiple times with
   * different parameters (if any parameters were provided), but which only
   * compiles the underlying Kysely query builder on the first execution.
   * Frees the query builder on the first execution to reduce memory usage.
   * @typeParam Parameters Record characterizing the parameter names and
   *  types that were previously embedded in the query, if any.
   * @returns A compiling insert query.
   */
  compile(): CompilingMappingInsertQuery<
    DB,
    TB,
    QB,
    InsertedObject,
    InsertReturnColumns,
    InsertReturn
  > {
    return new CompilingMappingInsertQuery(
      this.db,
      this.qb,
      this.columnsToInsert,
      this.transforms,
      this.returnColumns
    );
  }

  protected override getInsertColumns():
    | Readonly<(keyof Insertable<DB[TB]> & string)[]>
    | ['*'] {
    return this.columnsToInsert;
  }

  protected override setColumnValues(
    qb: InsertQueryBuilder<DB, TB, InsertResult>,
    objOrObjs: Insertable<DB[TB]> | Insertable<DB[TB]>[]
  ): InsertQueryBuilder<DB, TB, InsertResult> {
    if (Array.isArray(objOrObjs)) {
      return qb.values(
        objOrObjs.map((obj) => restrictValues(obj, this.columnsToInsert))
      );
    }
    return qb.values(restrictValues(objOrObjs, this.columnsToInsert));
  }
}
