import { Kysely, UpdateQueryBuilder, UpdateResult, Updateable } from 'kysely';
import { ParametersObject } from 'kysely-params';

import { SelectionColumn } from '../lib/type-utils.js';
import { MappingUpdateQuery } from './update-query.js';
import { ParameterizableMappingQuery } from './parameterizable-query.js';
import { CompilingMappingUpdateQuery } from './compiling-update-query.js';
import {
  CountTransform,
  UpdateTransforms,
} from '../mappers/table-mapper-transforms.js';
import { restrictValues } from '../lib/restrict-values.js';

/**
 * Mapping query for updating rows into a database table,
 * updating a specified subset of the updateable columns.
 */
export class SubsettingMappingUpdateQuery<
    DB,
    TB extends keyof DB & string,
    QB extends UpdateQueryBuilder<DB, TB, TB, UpdateResult>,
    UpdatingObject,
    UpdateReturnColumns extends Readonly<SelectionColumn<DB, TB>[]> | ['*'],
    ReturnCount,
    UpdateReturn
  >
  extends MappingUpdateQuery<
    DB,
    TB,
    QB,
    UpdatingObject,
    UpdateReturnColumns,
    ReturnCount,
    UpdateReturn
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
          UpdatingObject,
          UpdateReturnColumns,
          UpdateReturn
        >
    >,
    returnColumns: Readonly<UpdateReturnColumns>
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
   * @returns A compiling update query.
   */
  compile<
    Parameters extends ParametersObject<Parameters> = {}
  >(): CompilingMappingUpdateQuery<
    DB,
    TB,
    QB,
    UpdatingObject,
    UpdateReturnColumns,
    ReturnCount,
    UpdateReturn,
    Parameters
  > {
    return new CompilingMappingUpdateQuery(
      this.db,
      this.qb,
      this.columnsToUpdate,
      this.transforms,
      this.returnColumns
    );
  }

  protected override getUpdateColumns():
    | Readonly<(keyof Updateable<DB[TB]> & string)[]>
    | ['*'] {
    return this.columnsToUpdate;
  }

  protected override setColumnValues(
    qb: UpdateQueryBuilder<DB, TB, TB, UpdateResult>,
    obj: Updateable<DB[TB]>
  ): UpdateQueryBuilder<DB, TB, TB, UpdateResult> {
    return qb.set(restrictValues(obj, this.columnsToUpdate));
  }
}
