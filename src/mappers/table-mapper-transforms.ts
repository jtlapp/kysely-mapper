import { Insertable, Selectable, Selection, Updateable } from 'kysely';
import {
  SelectableColumnTuple,
  SelectedRow,
  SelectionColumn,
} from '../lib/type-utils';

/**
 * Transformations to apply to values provided to and received from queries.
 * All transformations are optional. When no transformation is provided, the
 * value is passed through unchanged.
 * @typeparam DB Interface whose fields are table names defining tables.
 * @typeparam TB Name of the table.
 * @typeparam KeyColumns Tuple of the names of the table's key columns.
 *  Defaults to `[]`, indicating no key columns.
 * @typeparam SelectedColumns Columns to return from selection queries.
 *  Defaults to `['*']`, returning all columns. May specify aliases.
 * @typeparam SelectedObject Type of objects returned by select queries.
 * @typeparam InsertedObject Type of objects inserted into the table.
 * @typeparam UpdatingObject Type of objects used to update rows of the table.
 * @typeparam ReturnCount Type of count query results.
 * @typeparam ReturnColumns Columns to return from the table on insert or
 *  update, except when explicitly requesting no columns. `['*']` returns
 *  all columns; `[]` returns none and is the default. May specify aliases.
 *  Defaults to `KeyColumns`.
 * @typeparam InsertReturnsSelectedObject Whether insert queries return
 *  `SelectedObject` or `DefaultReturnObject`.
 * @typeparam UpdateReturnsSelectedObjectWhenProvided Whether update queries
 *  return `SelectedObject` when the updating object is a `SelectedObject`;
 *  update queries otherwise return `DefaultReturnObject`.
 * @typeparam DefaultReturnObject Type of objects returned from inserts and
 *  updates, unless configured to return `SelectedObject`.
 */
export interface TableMapperTransforms<
  DB,
  TB extends keyof DB & string,
  KeyColumns extends Readonly<SelectableColumnTuple<DB[TB]>> | [] = [],
  SelectedColumns extends Readonly<SelectionColumn<DB, TB>[]> | ['*'] = ['*'],
  SelectedObject extends object = SelectedRow<
    DB,
    TB,
    SelectedColumns extends ['*'] ? never : SelectedColumns[number],
    SelectedColumns
  >,
  InsertedObject extends object = Insertable<DB[TB]>,
  UpdatingObject extends object = Updateable<DB[TB]>,
  ReturnCount = bigint,
  ReturnColumns extends
    | Readonly<SelectionColumn<DB, TB>[]>
    | ['*'] = KeyColumns,
  InsertReturnsSelectedObject extends boolean = false,
  UpdateReturnsSelectedObjectWhenProvided extends boolean = false,
  DefaultReturnObject extends object = ReturnColumns extends ['*']
    ? Selectable<DB[TB]>
    : Selection<DB, TB, ReturnColumns[number]>
> extends CountTransform<ReturnCount>,
    InsertTransforms<
      DB,
      TB,
      SelectedObject,
      InsertedObject,
      ReturnColumns,
      InsertReturnsSelectedObject,
      DefaultReturnObject
    >,
    SelectTransform<DB, TB, SelectedColumns, SelectedObject>,
    UpdateTransforms<
      DB,
      TB,
      SelectedObject,
      UpdatingObject,
      ReturnColumns,
      UpdateReturnsSelectedObjectWhenProvided,
      DefaultReturnObject
    > {}

export interface CountTransform<ReturnCount> {
  /**
   * Transformation to apply to bigint count results before returning
   * the count to the client. `count` is the count returned by the query.
   */
  countTransform?: (count: bigint) => ReturnCount;
}

export interface InsertTransforms<
  DB,
  TB extends keyof DB & string,
  SelectedObject extends object,
  InsertedObject extends object,
  ReturnColumns extends Readonly<SelectionColumn<DB, TB>[]> | ['*'],
  InsertReturnsSelectedObject extends boolean,
  DefaultReturnObject extends object
> {
  /**
   * Transformation to apply to inserted objects before insertion.
   * `source` is the object provided for insertion.
   */
  insertTransform?: (source: InsertedObject) => Insertable<DB[TB]>;

  /**
   * Transformation to apply to column values returned from inserts before
   * returning values to the client. When inferring type parameters, specify
   * a type for the `source` parameter. If you are returning an instance of
   * `SelectedObject`, be sure to set the `InsertReturnsSelectedObject`
   * setting to `true`. `source` is the object that was provided for
   * insertion, and `returns` are the values returned from the insert.
   */
  insertReturnTransform?: (
    source: InsertedObject,
    returns: ReturnColumns extends []
      ? never
      : SelectedRow<
          DB,
          TB,
          ReturnColumns extends ['*'] ? never : ReturnColumns[number],
          ReturnColumns
        >
  ) => InsertReturnsSelectedObject extends true
    ? SelectedObject
    : DefaultReturnObject;
}

export interface SelectTransform<
  DB,
  TB extends keyof DB & string,
  SelectedColumns extends Readonly<SelectionColumn<DB, TB>[]> | ['*'],
  SelectedObject extends object
> {
  /**
   * Transformation to apply to selected objects after retrieval from the
   * database and before returning to the client. `row` is the selected
   * row, as returned by the Kysely query.
   */
  selectTransform?: (
    row: SelectedRow<
      DB,
      TB,
      SelectedColumns extends ['*'] ? never : SelectedColumns[number],
      SelectedColumns
    >
  ) => SelectedObject;
}

export interface UpdateTransforms<
  DB,
  TB extends keyof DB & string,
  SelectedObject extends object,
  UpdatingObject extends object,
  ReturnColumns extends Readonly<SelectionColumn<DB, TB>[]> | ['*'],
  UpdateReturnsSelectedObjectWhenProvided extends boolean,
  DefaultReturnObject extends object
> {
  /**
   * Transformation to apply to objects provided for updating rows. `source`
   * is the object containing the values which which to update the table row.
   */
  updateTransform?: (source: UpdatingObject) => Updateable<DB[TB]>;

  /**
   * Transformation to apply to column values returned from updates before
   * returning values to the client. When inferring type parameters, specify
   * a type for the `source` parameter. If you return an instance of
   * `SelectedObject` when the updating object is a `SelectedObject`, be sure
   * to set the `UpdateReturnsSelectedObjectWhenProvided` setting to `true`.
   * `source` is the object that contained the valiues with which the table
   * row was updated, and `returns` are the values returned from the update.
   */
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
    : DefaultReturnObject;
}
