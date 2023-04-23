import { SelectableColumnTuple, SelectionColumn } from '../lib/type-utils';

/**
 * Settings governing table mapper behavior, excluding transformations.
 * @typeParam DB Interface whose fields are table names defining tables.
 * @typeParam TB Name of the table.
 * @typeParam KeyColumns Tuple of the names of the table's key columns.
 *  Defaults to `[]`, indicating no key columns. Supports up to 4 columns.
 * @typeParam SelectedColumns Columns to return from selection queries.
 *  Defaults to `['*']`, returning all columns. May specify aliases.
 * @typeParam InsertReturnColumns Columns to return from the table on insert
 *  queries that return columns. `['*']` returns all columns; `[]` returns
 *  none. May specify aliases. Defaults to `KeyColumns`.
 * @typeParam UpdateReturnColumns Columns to return from the table on update
 *  queries that return columns. `['*']` returns all columns; `[]` returns
 *  none and is the default. May specify aliases.
 */
export interface TableMapperSettings<
  DB,
  TB extends keyof DB & string,
  KeyColumns extends
    | Readonly<SelectableColumnTuple<DB[TB]>>
    | Readonly<[]> = [],
  SelectedColumns extends Readonly<SelectionColumn<DB, TB>[]> | ['*'] = ['*'],
  InsertReturnColumns extends
    | Readonly<SelectionColumn<DB, TB>[]>
    | ['*'] = Readonly<KeyColumns>,
  UpdateReturnColumns extends Readonly<SelectionColumn<DB, TB>[]> | ['*'] = []
> {
  /**
   * Tuple of the columns that make up the table's key. Defaults to `[]`,
   * indicating that no columns are keys.
   */
  keyColumns?: KeyColumns;

  /**
   * Columns to return from selection queries. Defaults to `[*]`, selecting
   * all columns. May contain aliases.
   */
  selectedColumns?: SelectedColumns;

  /**
   * Columns to return from insert queries that return columns. `['*']`
   * returns all columns; `[]` returns none. May specify aliases. Defaults
   * to `KeyColumns`.
   */

  insertReturnColumns?: InsertReturnColumns;

  /**
   * Columns to return from update queries that return columns. `['*']` returns
   * all columns; `[]` returns none and is the default. May specify aliases.
   */
  updateReturnColumns?: UpdateReturnColumns;
}
