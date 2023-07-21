import { Kysely, UpdateQueryBuilder, UpdateResult, Updateable } from 'kysely';

import { SelectionColumn } from '../lib/type-utils.js';
import { MappingUpdateQuery } from './update-query.js';
import { SubsettingMappingUpdateQuery } from './subsetting-update-query.js';
import {
  CountTransform,
  UpdateTransforms,
} from '../mappers/table-mapper-transforms.js';

/**
 * Mapping query for updating rows from a database table, where the
 * columns to be updated have not been restricted.
 */
export class AnyColumnsMappingUpdateQuery<
  DB,
  TB extends keyof DB & string,
  QB extends UpdateQueryBuilder<DB, TB, TB, UpdateResult>,
  UpdatingObject,
  UpdateReturnColumns extends Readonly<SelectionColumn<DB, TB>[]> | ['*'],
  ReturnCount,
  UpdateReturn
> extends MappingUpdateQuery<
  DB,
  TB,
  QB,
  UpdatingObject,
  UpdateReturnColumns,
  ReturnCount,
  UpdateReturn
> {
  constructor(
    db: Kysely<DB>,
    qb: QB,
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
   * Returns a mapping query that only updates a specified subset of columns.
   * @param columns The columns to update. All are required, but this
   *  constraint is only enforced at runtime, not by the type system.
   * @returns A mapping query that only updates the specified columns.
   */
  columns(
    columnsToUpdate: Readonly<(keyof Updateable<DB[TB]> & string)[]>
  ): SubsettingMappingUpdateQuery<
    DB,
    TB,
    QB,
    UpdatingObject,
    UpdateReturnColumns,
    ReturnCount,
    UpdateReturn
  > {
    return new SubsettingMappingUpdateQuery(
      this.db,
      this.qb,
      columnsToUpdate,
      this.transforms,
      this.returnColumns
    );
  }
}
