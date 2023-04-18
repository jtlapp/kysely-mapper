import { SelectableColumnTuple, SelectionColumn } from '../lib/type-utils';
import { TableMapperSettings } from './table-mapper-settings';

/**
 * Uniform table mapper settings
 * @typeparam DB The database type.
 * @typeparam TB The name of the table.
 * @typeparam KeyColumns Tuple of the names of the table's key columns.
 *  Defaults to `['id']`. `[]` indicates no key columns.
 * @typeparam SelectedColumns Columns to return from selection queries.
 *  Defaults to `['*']`, returning all columns. May specify aliases.
 * @typeparam ReturnColumns The columns that are returned from the database
 *  when selecting or updating rows, for use when creating the mapped objects.
 *  `['*']` returns all columns; `[]` returns none. May specify aliases.
 *  Defaults to `KeyColumns`.
 */
export interface UniformTableMapperSettings<
  DB,
  TB extends keyof DB & string,
  KeyColumns extends Readonly<SelectableColumnTuple<DB[TB]>> | [],
  SelectedColumns extends Readonly<SelectionColumn<DB, TB>[]> | ['*'],
  ReturnColumns extends Readonly<SelectionColumn<DB, TB>[]> | ['*']
> extends TableMapperSettings<
    DB,
    TB,
    KeyColumns,
    SelectedColumns,
    ReturnColumns,
    true,
    true
  > {
  /** Indicates whether the provided object is an instance of `MappedObject`. */
  // Not using a type guard because it complicates assignment of the option.
  isMappedObject: (obj: any) => boolean;
}
