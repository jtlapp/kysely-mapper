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
 * @typeParam DB Interface whose fields are table names defining tables.
 * @typeParam TB Name of the table.
 * @typeParam KeyColumns Tuple of the names of the table's key columns.
 *  Defaults to `[]`, indicating no key columns. Supports up to 4 columns.
 * @typeParam SelectedColumns Columns to return from selection queries.
 *  Defaults to `['*']`, returning all columns. May specify aliases.
 * @typeParam SelectedObject Type of objects returned by select queries.
 * @typeParam InsertedObject Type of objects inserted into the table.
 * @typeParam UpdatingObject Type of objects used to update rows of the table.
 * @typeParam Type of the count of the number of affected rows.
 * @typeParam InsertReturnColumns Columns to return from the table on insert
 *  queries that return columns. `['*']` returns all columns; `[]` returns
 *  none. May specify aliases. Defaults to `KeyColumns`.
 * @typeParam UpdateReturnColumns Columns to return from the table on update
 *  queries that return columns. `['*']` returns all columns; `[]` returns
 *  none and is the default. May specify aliases.
 * @typeParam InsertReturn Type returned from inserts. Defaults to an object
 *  whose properties are the columns of `InsertReturnColumns`.
 * @typeParam UpdateReturn Type returned from updates. Defaults to an object
 *  whose properties are the columns of `UpdateReturnColumns`.
 */
export interface TableMapperTransforms<
  DB,
  TB extends keyof DB & string,
  KeyColumns extends
    | Readonly<SelectableColumnTuple<DB[TB]>>
    | Readonly<[]> = [],
  SelectedColumns extends Readonly<SelectionColumn<DB, TB>[]> | ['*'] = ['*'],
  SelectedObject = SelectedRow<
    DB,
    TB,
    SelectedColumns extends ['*'] ? never : SelectedColumns[number],
    SelectedColumns
  >,
  InsertedObject = Insertable<DB[TB]>,
  UpdatingObject = Updateable<DB[TB]>,
  ReturnCount = bigint,
  InsertReturnColumns extends
    | Readonly<SelectionColumn<DB, TB>[]>
    | ['*'] = Readonly<KeyColumns>,
  UpdateReturnColumns extends Readonly<SelectionColumn<DB, TB>[]> | ['*'] = [],
  InsertReturn = InsertReturnColumns extends ['*']
    ? Selectable<DB[TB]>
    : Selection<DB, TB, InsertReturnColumns[number]>,
  UpdateReturn = UpdateReturnColumns extends ['*']
    ? Selectable<DB[TB]>
    : Selection<DB, TB, UpdateReturnColumns[number]>
> extends CountTransform<ReturnCount>,
    InsertTransforms<DB, TB, InsertedObject, InsertReturnColumns, InsertReturn>,
    SelectTransform<DB, TB, SelectedColumns, SelectedObject>,
    UpdateTransforms<
      DB,
      TB,
      UpdatingObject,
      UpdateReturnColumns,
      UpdateReturn
    > {}

export interface CountTransform<ReturnCount> {
  /**
   * Transformation to apply to bigint count results indicating the number of
   * rows affected, before returning the count to the client. `count` is the
   * count returned by the query.
   */
  countTransform?: (count: bigint) => ReturnCount;
}

export interface InsertTransforms<
  DB,
  TB extends keyof DB & string,
  InsertedObject,
  InsertReturnColumns extends Readonly<SelectionColumn<DB, TB>[]> | ['*'],
  InsertReturn
> {
  /**
   * Transformation to apply to inserted objects before insertion. `source`
   * is the object provided for insertion. Only the columns in `columns` will
   * actually be inserted, with `[*]` indicating all columns.
   */
  insertTransform?: (
    source: InsertedObject,
    columns: Readonly<(keyof Insertable<DB[TB]> & string)[]> | ['*']
  ) => Insertable<DB[TB]>;

  /**
   * Transformation to apply to column values returned from inserts before
   * returning values to the client. When inferring type parameters, specify
   * a type for the `source` parameter. `source` is the object that was provided
   * for insertion, and `returns` are the values returned from the insert.
   */
  insertReturnTransform?: (
    source: InsertedObject,
    returns: InsertReturnColumns extends []
      ? never
      : SelectedRow<
          DB,
          TB,
          InsertReturnColumns extends ['*']
            ? never
            : InsertReturnColumns[number],
          InsertReturnColumns
        >
  ) => InsertReturn;
}

export interface SelectTransform<
  DB,
  TB extends keyof DB & string,
  SelectedColumns extends Readonly<SelectionColumn<DB, TB>[]> | ['*'],
  SelectedObject
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
  UpdatingObject,
  UpdateReturnColumns extends Readonly<SelectionColumn<DB, TB>[]> | ['*'],
  UpdateReturn
> {
  /**
   * Transformation to apply to objects provided for updating rows. `source`
   * is the object containing the values which which to update the table row.
   * Only the columns in `columns` will actually be updated, with `[*]`
   * indicating all columns.
   */
  updateTransform?: (
    source: UpdatingObject,
    columns: Readonly<(keyof Updateable<DB[TB]> & string)[]> | ['*']
  ) => Updateable<DB[TB]>;

  /**
   * Transformation to apply to column values returned from updates before
   * returning values to the client. When inferring type parameters, specify
   * a type for the `source` parameter. `source` is the object that contained
   * the valiues with which the table row was updated, and `returns` are the
   * values returned from the update.
   */
  updateReturnTransform?: (
    source: UpdatingObject,
    returns: UpdateReturnColumns extends []
      ? never
      : SelectedRow<
          DB,
          TB,
          UpdateReturnColumns extends ['*']
            ? never
            : UpdateReturnColumns[number],
          UpdateReturnColumns
        >
  ) => UpdateReturn;
}
