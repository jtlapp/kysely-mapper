import {
  AllColumns,
  SelectableColumnTuple,
  SelectionColumn,
} from '../lib/type-utils';

/**
 * General table mapper settings
 * @typeparam DB Interface whose fields are table names defining tables.
 * @typeparam TB Name of the table.
 * @typeparam KeyColumns Tuple of the names of the table's key columns.
 *  Defaults to `[]`, indicating no key columns.
 * @typeparam SelectedColumns Columns to return from selection queries.
 *  Defaults to `['*']`, returning all columns. May specify aliases.
 * @typeparam ReturnColumns Columns to return from the table on insert or
 *  update, except when explicitly requesting no columns. `['*']` returns
 *  all columns; `[]` returns none and is the default. May specify aliases.
 *  Defaults to `KeyColumns`.
 * @typeparam InsertReturnsSelectedObject Whether insert queries return
 *  `SelectedObject` or `DefaultReturnObject`.
 * @typeparam UpdateReturnsSelectedObjectWhenProvided Whether update queries
 *  return `SelectedObject` when the updating object is a `SelectedObject`;
 *  update queries otherwise return `DefaultReturnObject`.
 */
export interface TableMapperSettings<
  DB,
  TB extends keyof DB & string,
  KeyColumns extends Readonly<SelectableColumnTuple<DB[TB]>> | [] = [],
  SelectedColumns extends
    | Readonly<SelectionColumn<DB, TB>[]>
    | AllColumns = AllColumns,
  ReturnColumns extends
    | Readonly<SelectionColumn<DB, TB>[]>
    | AllColumns = KeyColumns,
  InsertReturnsSelectedObject extends boolean = false,
  UpdateReturnsSelectedObjectWhenProvided extends boolean = false
> {
  /** Tuple of the columns that make up the table's key. May be `[]`. */
  keyColumns?: KeyColumns;

  /**
   * Columns to return from selection queries. `[*]` selects all columns.
   * May contain aliases.
   */
  selectedColumns?: SelectedColumns;

  /**
   * Whether insert queries return `SelectedObject` or `DefaultReturnObject`.
   */
  insertReturnsSelectedObject?: InsertReturnsSelectedObject;

  /**
   * Whether update queries return `SelectedObject` when the updating object
   * is a `SelectedObject`; update queries otherwise return `DefaultReturnObject`.
   */
  updateReturnsSelectedObjectWhenProvided?: UpdateReturnsSelectedObjectWhenProvided;

  /**
   * Columns to return from the table on insert or update, unless explicitly
   * requesting no columns. `['*']` returns all columns; `[]` returns none.
   * May contain aliases.
   */
  returnColumns?: ReturnColumns;
}
