import { Insertable, Selectable, Selection, Updateable } from 'kysely';
import {
  SelectableColumnTuple,
  SelectedRow,
  SelectionColumn,
} from '../lib/type-utils';

/**
 * Options governing TableMapper behavior.
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
  KeyColumns extends SelectableColumnTuple<DB[TB]> | [] = [],
  SelectedColumns extends SelectionColumn<DB, TB>[] | ['*'] = ['*'],
  SelectedObject extends object = SelectedRow<
    DB,
    TB,
    SelectedColumns extends ['*'] ? never : SelectedColumns[number],
    SelectedColumns
  >,
  InsertedObject extends object = Insertable<DB[TB]>,
  UpdatingObject extends object = Updateable<DB[TB]>,
  ReturnCount = bigint,
  ReturnColumns extends SelectionColumn<DB, TB>[] | ['*'] = KeyColumns,
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
  /** Transformation to apply to bigint count results. */
  countTransform?: (count: bigint) => ReturnCount;
}

export interface InsertTransforms<
  DB,
  TB extends keyof DB & string,
  SelectedObject extends object,
  InsertedObject extends object,
  ReturnColumns extends SelectionColumn<DB, TB>[] | ['*'],
  InsertReturnsSelectedObject extends boolean,
  DefaultReturnObject extends object
> {
  /** Transformation to apply to inserted objects before insertion. */
  insertTransform?: (obj: InsertedObject) => Insertable<DB[TB]>;

  /** Transformation to apply to column values returned from inserts. */
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
  SelectedColumns extends SelectionColumn<DB, TB>[] | ['*'],
  SelectedObject extends object
> {
  /** Transformation to apply to selected objects. */
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
  ReturnColumns extends SelectionColumn<DB, TB>[] | ['*'],
  UpdateReturnsSelectedObjectWhenProvided extends boolean,
  DefaultReturnObject extends object
> {
  /** Transformation to apply to objects provided for updating values. */
  updateTransform?: (update: UpdatingObject) => Updateable<DB[TB]>;

  /** Transformation to apply to column values returned from updates. */
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
