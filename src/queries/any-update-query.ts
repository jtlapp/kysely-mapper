import {
  Kysely,
  Selection,
  UpdateQueryBuilder,
  UpdateResult,
  Updateable,
} from 'kysely';
import { SelectionColumn } from '../lib/type-utils';
import { MappingUpdateQuery } from './update-query';
import { SubsettingMappingUpdateQuery } from './subsetting-update-query';

/**
 * Mapping query for updating rows from a database table, where the
 * columns to be updated have not been restricted.
 */
export class AnyColumnsMappingUpdateQuery<
  DB,
  TB extends keyof DB & string,
  QB extends UpdateQueryBuilder<DB, TB, TB, UpdateResult>,
  UpdatingObject extends object,
  SelectedObject extends object,
  ReturnColumns extends SelectionColumn<DB, TB>[] | ['*'],
  ReturnCount,
  UpdateReturnsSelectedObjectWhenProvided extends boolean,
  DefaultReturnObject extends object
> extends MappingUpdateQuery<
  DB,
  TB,
  QB,
  UpdatingObject,
  SelectedObject,
  ReturnColumns,
  ReturnCount,
  UpdateReturnsSelectedObjectWhenProvided,
  DefaultReturnObject
> {
  constructor(
    db: Kysely<DB>,
    qb: QB,
    countTransform: (count: bigint) => ReturnCount,
    updateTransform?: (update: UpdatingObject) => Updateable<DB[TB]>,
    returnColumns?: ReturnColumns,
    updateReturnTransform?: (
      source: UpdatingObject,
      returns: Selection<DB, TB, ReturnColumns[number]>
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
   * Returns a mapping query that only updates a specified subset of columns.
   * @param columns The columns to update. All are required, but this
   *  constraint is only enforced at runtime, not by the type system.
   * @returns A mapping query that only updates the specified columns.
   */
  columns(
    columnsToUpdate: (keyof Updateable<DB[TB]> & string)[]
  ): SubsettingMappingUpdateQuery<
    DB,
    TB,
    QB,
    UpdatingObject,
    SelectedObject,
    ReturnColumns,
    ReturnCount,
    UpdateReturnsSelectedObjectWhenProvided,
    DefaultReturnObject
  > {
    return new SubsettingMappingUpdateQuery(
      this.db,
      this.qb,
      columnsToUpdate,
      this.countTransform,
      this.updateTransform,
      this.returnColumns,
      this.updateReturnTransform
    );
  }
}
