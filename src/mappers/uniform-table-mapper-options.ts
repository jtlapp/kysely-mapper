import { Insertable } from 'kysely';
import { SelectableColumnTuple, SelectionColumn } from '../lib/type-utils';
import { TableMapperOptions } from './table-mapper-options';

/**
 * Options governing UniformTableMapper behavior.
 * @typeparam DB The database type.
 * @typeparam TB The name of the table.
 * @typeparam MappedObject The type of the objects that are mapped to and from
 *  the table rows on inserts, updates, and selects. Updates may also be given
 *  as columns of the table.
 * @typeparam KeyColumns Tuple of the names of the table's key columns.
 *  Defaults to `['id']`.
 * @typeparam SelectedColumns Columns to return from selection queries.
 *  Defaults to `['*']`, returning all columns. May specify aliases.
 * @typeparam ReturnColumns The columns that are returned from the database
 *  when selecting or updating rows, for use when creating the mapped objects.
 *  `['*']` returns all columns; `[]` returns none. May specify aliases.
 *  Defaults to `KeyColumns`.
 * @typeparam ReturnCount Type of count query results.
 */
export interface UniformTableMapperOptions<
  DB,
  TB extends keyof DB & string,
  MappedObject extends object,
  KeyColumns extends SelectableColumnTuple<DB[TB]>,
  SelectedColumns extends SelectionColumn<DB, TB>[] | ['*'],
  ReturnColumns extends SelectionColumn<DB, TB>[] | ['*'],
  ReturnCount
> extends TableMapperOptions<
    DB,
    TB,
    SelectedColumns,
    MappedObject,
    MappedObject,
    // TODO: look into changing Partial<Insertable<>> into Updateable<>.
    MappedObject | Partial<Insertable<DB[TB]>>,
    ReturnColumns,
    ReturnCount,
    true,
    true
  > {
  /** Tuple of the columns that make up the table's key. */
  readonly KeyColumns?: KeyColumns;

  /** Indicates whether the provided object is an instance of `MappedObject`. */
  // Not using a type guard because it complicates assignment of the option.
  readonly isMappedObject: (obj: any) => boolean;
}
