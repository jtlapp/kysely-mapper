import {
  Kysely,
  Selection,
  UpdateQueryBuilder,
  UpdateResult,
  Updateable,
} from 'kysely';
import { SelectionColumn } from '../lib/type-utils';
import { MappingUpdateQuery } from './update-query';
import { ParameterizableMappingSelectQuery } from './compilable-query';

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
  implements ParameterizableMappingSelectQuery
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
