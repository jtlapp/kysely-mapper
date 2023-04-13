import { Insertable, Selectable } from 'kysely';
import { SelectableColumnTuple, SelectionColumn } from '../lib/type-utils';
import { TableMapperOptions } from './table-mapper-options';

/**
 * Options governing UniformTableMapper behavior.
 * @typeparam DB The database type.
 * @typeparam TB The name of the table.
 * @typeparam MappedObject The type of the objects that are mapped to and from
 *  the table rows on inserts, updates, and selects. Updates may also be given
 *  as columns of the table.
 * @typeparam PrimaryKeyColumns Tuple of the names of the primary key columns.
 *  Defaults to `['id']`.
 * @typeparam ReturnColumns The columns that are returned from the database
 *  when selecting or updating rows, for use when creating the mapped objects.
 *  `['*']` returns all columns; `[]` returns none. Defaults to `PrimaryKeyColumns`.
 * @typeparam ReturnCount Type of count query results.
 */
export interface UniformTableMapperOptions<
  DB,
  TB extends keyof DB & string,
  MappedObject extends object,
  PrimaryKeyColumns extends SelectableColumnTuple<DB[TB]>,
  SelectedColumns extends SelectionColumn<DB, TB>[] | ['*'],
  // TODO: update the following type to support aliases
  ReturnColumns extends (keyof Selectable<DB[TB]> & string)[] | ['*'],
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
    true,
    MappedObject
  > {
  /** Columns that make up the primary key of the table. */
  readonly primaryKeyColumns?: PrimaryKeyColumns;

  /** Indicates whether the provided object is an instance of `MappedObject`. */
  readonly isMappedObject: (obj: any) => boolean;
}
