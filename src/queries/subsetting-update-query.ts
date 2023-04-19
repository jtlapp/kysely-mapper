import { Kysely, UpdateQueryBuilder, UpdateResult, Updateable } from 'kysely';
import { SelectionColumn } from '../lib/type-utils';
import { MappingUpdateQuery } from './update-query';
import { ParameterizableMappingQuery } from './parameterizable-query';
import { ParametersObject } from 'kysely-params';
import { CompilingMappingUpdateQuery } from './compiling-update-query';
import {
  CountTransform,
  UpdateTransforms,
} from '../mappers/table-mapper-transforms';

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
    ReturnColumns extends Readonly<SelectionColumn<DB, TB>[]> | ['*'],
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
    protected readonly columnsToUpdate: Readonly<
      (keyof Updateable<DB[TB]> & string)[]
    >,
    transforms: Readonly<
      CountTransform<ReturnCount> &
        UpdateTransforms<
          DB,
          TB,
          SelectedObject,
          UpdatingObject,
          ReturnColumns,
          UpdateReturnsSelectedObjectWhenProvided,
          DefaultReturnObject
        >
    >,
    returnColumns: Readonly<ReturnColumns>
  ) {
    super(db, qb, transforms, returnColumns);
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
      this.transforms,
      this.returnColumns
    );
  }

  protected override setColumnValues(
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
