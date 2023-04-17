import { Kysely, UpdateQueryBuilder, UpdateResult, Updateable } from 'kysely';
import { SelectedRow, SelectionColumn } from '../lib/type-utils';
import { MappingUpdateQuery } from './update-query';
import { ParameterizableMappingQuery } from './paramable-query';
import { ParametersObject } from 'kysely-params';
import { CompilingMappingUpdateQuery } from './compiling-update-query';

/**
 * Mapping query for updating rows into a database table,
 * updating a specified subset of the updateable columns.
 */
export class SubsettingMappingUpdateQuery<
    DB,
    TB extends keyof DB & string,
    QB extends UpdateQueryBuilder<DB, TB, TB, UpdateResult>,
    UpdatingObject extends object,
    SelectedObject extends object,
    ReturnColumns extends SelectionColumn<DB, TB>[] | ['*'],
    ReturnCount,
    UpdateReturnsSelectedObjectWhenProvided extends boolean,
    DefaultReturnObject extends object
  >
  extends MappingUpdateQuery<
    DB,
    TB,
    QB,
    UpdatingObject,
    SelectedObject,
    ReturnColumns,
    ReturnCount,
    UpdateReturnsSelectedObjectWhenProvided,
    DefaultReturnObject
  >
  implements ParameterizableMappingQuery
{
  constructor(
    db: Kysely<DB>,
    qb: QB,
    protected readonly columnsToUpdate: (keyof Updateable<DB[TB]> & string)[],
    countTransform: (count: bigint) => ReturnCount,
    updateTransform?: (update: UpdatingObject) => Updateable<DB[TB]>,
    returnColumns?: ReturnColumns,
    updateReturnTransform?: (
      source: UpdatingObject,
      returns: ReturnColumns extends []
        ? never
        : SelectedRow<
            DB,
            TB,
            ReturnColumns extends ['*'] ? never : ReturnColumns[number],
            ReturnColumns
          >
    ) => UpdateReturnsSelectedObjectWhenProvided extends true
      ? UpdatingObject extends SelectedObject
        ? SelectedObject
        : DefaultReturnObject
      : DefaultReturnObject
  ) {
    super(
      db,
      qb,
      countTransform,
      updateTransform,
      returnColumns,
      updateReturnTransform
    );
  }

  /**
   * Returns a compiling query that can be executed multiple times with
   * different parameters (if any parameters were provided), but which only
   * compiles the underlying Kysely query builder on the first execution.
   * Frees the query builder on the first execution to reduce memory usage.
   * @typeparam P Record characterizing the parameter names and types
   *  that were previously embedded in the query, if any.
   * @returns A compiling update query.
   */
  compile<P extends ParametersObject<P> = {}>(): CompilingMappingUpdateQuery<
    DB,
    TB,
    QB,
    UpdatingObject,
    SelectedObject,
    ReturnColumns,
    ReturnCount,
    UpdateReturnsSelectedObjectWhenProvided,
    DefaultReturnObject,
    P
  > {
    return new CompilingMappingUpdateQuery(
      this.db,
      this.qb,
      this.columnsToUpdate,
      this.countTransform,
      this.updateTransform,
      this.returnColumns,
      this.updateReturnTransform
    );
  }

  protected setColumnValues(
    qb: UpdateQueryBuilder<DB, TB, TB, UpdateResult>,
    obj: Updateable<DB[TB]>
  ): UpdateQueryBuilder<DB, TB, TB, UpdateResult> {
    return qb.set(this.toUpdateableObject(obj));
  }

  protected toUpdateableObject(obj: Updateable<DB[TB]>): Updateable<DB[TB]> {
    this.columnsToUpdate.forEach((column) => {
      if (!(column in obj)) {
        throw Error(
          `Specified column '${column}' missing from updating object`
        );
      }
    });
    return Object.fromEntries(
      Object.entries(obj).filter(([column]) =>
        this.columnsToUpdate.includes(column as any)
      )
    ) as Updateable<DB[TB]>;
  }
}
