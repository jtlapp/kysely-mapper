import { SelectableColumnTuple, SelectionColumn } from '../lib/type-utils';
import { TableMapperSettings } from './table-mapper-settings';

/**
 * Settings governing uniform table mapper behavior, excluding transformations.
 * @typeparam DB The database type.
 * @typeparam TB The name of the table.
 * @typeparam KeyColumns Tuple of the names of the table's key columns.
 *  Defaults to `['id']`. `[]` indicates no key columns.
 * @typeparam SelectedColumns Columns to return from selection queries.
 *  Defaults to `['*']`, returning all columns. May specify aliases.
 * @typeparam InsertReturnColumns Columns to return from the table on insert
 *  queries that return columns. `['*']` returns all columns; `[]` returns
 *  none. May specify aliases. Defaults to `KeyColumns`.
 * @typeparam UpdateReturnColumns Columns to return from the table on update
 *  queries that return columns. `['*']` returns all columns; `[]` returns
 *  none and is the default. May specify aliases.
 */
export interface UniformTableMapperSettings<
  DB,
  TB extends keyof DB & string,
  KeyColumns extends Readonly<SelectableColumnTuple<DB[TB]>> | [],
  SelectedColumns extends Readonly<SelectionColumn<DB, TB>[]> | ['*'],
  InsertReturnColumns extends
    | Readonly<SelectionColumn<DB, TB>[]>
    | ['*'] = Readonly<KeyColumns>,
  UpdateReturnColumns extends Readonly<SelectionColumn<DB, TB>[]> | ['*'] = []
> extends TableMapperSettings<
    DB,
    TB,
    KeyColumns,
    SelectedColumns,
    InsertReturnColumns,
    UpdateReturnColumns
  > {
  /** Indicates whether the provided object is an instance of `MappedObject`. */
  // Not using a type guard because it complicates assignment of the option.
  // TODO: Do I still need this?
  isMappedObject: (obj: any) => boolean;
}
