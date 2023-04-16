import {
  Kysely,
  InsertQueryBuilder,
  InsertResult,
  Selection,
  Insertable,
} from 'kysely';

import { SelectionColumn } from '../lib/type-utils';
import { MappingInsertQuery } from './insert-query';
import { ParameterizableMappingQuery } from './paramable-query';
import { ParametersObject } from 'kysely-params';
import { CompilingMappingInsertQuery } from './compiling-insert-query';

// TODO: where else should I use Map or Set instead of objects?

/**
 * Mapping query for inserting rows into a database table,
 * inserting a specified subset of the insertable columns.
 */
export class SubsettingMappingInsertQuery<
    DB,
    TB extends keyof DB & string,
    QB extends InsertQueryBuilder<DB, TB, InsertResult>,
    InsertedObject extends object,
    SelectedObject extends object,
    ReturnColumns extends SelectionColumn<DB, TB>[] | ['*'],
    InsertReturnsSelectedObject extends boolean,
    DefaultReturnObject extends object
  >
  extends MappingInsertQuery<
    DB,
    TB,
    QB,
    InsertedObject,
    SelectedObject,
    ReturnColumns,
    InsertReturnsSelectedObject,
    DefaultReturnObject
  >
  implements ParameterizableMappingQuery
{
  constructor(
    db: Kysely<DB>,
    qb: QB,
    protected readonly columnsToInsert: (keyof Insertable<DB[TB]> & string)[],
    insertTransform?: (obj: InsertedObject) => Insertable<DB[TB]>,
    returnColumns?: ReturnColumns,
    insertReturnTransform?: (
      source: InsertedObject,
      returns: ReturnColumns extends []
        ? never
        : Selection<DB, TB, ReturnColumns[number]>
    ) => InsertReturnsSelectedObject extends true
      ? SelectedObject
      : DefaultReturnObject
  ) {
    super(db, qb, insertTransform, returnColumns, insertReturnTransform);
  }

  /**
   * Returns a compiling query that can be executed multiple times with
   * different parameters (if any parameters were provided), but which only
   * compiles the underlying Kysely query builder on the first execution.
   * Frees the query builder on the first execution to reduce memory usage.
   * @typeparam P Record characterizing the parameter names and types
   *  that were previously embedded in the query, if any.
   * @returns A compiling insert query.
   */
  compile<P extends ParametersObject<P> = {}>(): CompilingMappingInsertQuery<
    DB,
    TB,
    QB,
    InsertedObject,
    SelectedObject,
    ReturnColumns,
    InsertReturnsSelectedObject,
    DefaultReturnObject
  > {
    return new CompilingMappingInsertQuery(
      this.db,
      this.qb,
      this.columnsToInsert,
      this.insertTransform,
      this.returnColumns,
      this.insertReturnTransform
    );
  }

  protected setColumnValues(
    qb: InsertQueryBuilder<DB, TB, InsertResult>,
    objOrObjs: Insertable<DB[TB]> | Insertable<DB[TB]>[]
  ): InsertQueryBuilder<DB, TB, InsertResult> {
    if (Array.isArray(objOrObjs)) {
      return qb.values(objOrObjs.map((obj) => this.toInsertableObject(obj)));
    }
    return qb.values(this.toInsertableObject(objOrObjs));
  }

  protected toInsertableObject(obj: Insertable<DB[TB]>): Insertable<DB[TB]> {
    this.columnsToInsert.forEach((column) => {
      if (!(column in obj)) {
        throw Error(
          `Specified column '${column}' missing from inserted object`
        );
      }
    });
    return Object.fromEntries(
      Object.entries(obj).filter(([column]) =>
        this.columnsToInsert.includes(column as any)
      )
    ) as Insertable<DB[TB]>;
  }
}
