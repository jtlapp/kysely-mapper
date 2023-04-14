import { Insertable, Kysely, Selectable, Selection } from 'kysely';

import { TableMapper } from './table-mapper';
import {
  SelectableColumn,
  SelectableColumnTuple,
  SelectionColumn,
} from '../lib/type-utils';
import { UniformTableMapperOptions } from './uniform-table-mapper-options';

// TODO: look into having this class add tuple keys to method filters
//  (or should it be based on a class that does this?)

/** Default key columns */
export const DEFAULT_KEY = ['id'] as const;

/**
 * A mapper for a table representing a store of objects.
 * @typeparam DB The database type.
 * @typeparam TB The name of the table.
 * @typeparam MappedObject The type of the objects that are mapped to and from
 *  the table rows on inserts, updates, and selects. Updates may also be given
 *  as columns of the table.
 * @typeparam KeyColumns Tuple of the names of the table's key columns.
 *  Defaults to `['id']`. By default, falsy key values are assumed to require
 *  generation and `insertTransform` removes them from the insertion.
 * @typeparam SelectedColumns Columns to return from selection queries.
 *  Defaults to `['*']`, returning all columns. May specify aliases.
 * @typeparam ReturnCount Type of count query results.
 * @typeparam ReturnColumns The columns that are returned from the database
 *  when selecting or updating rows, for use when creating mapped objects.
 *  `['*']` returns all columns; `[]` returns none. By default, the columns
 *  are added to objects returned on update. Defaults to `KeyColumns`.
 */
export class UniformTableMapper<
  DB,
  TB extends keyof DB & string,
  MappedObject extends object,
  KeyColumns extends SelectableColumnTuple<DB[TB]> | [] = [
    'id' & SelectableColumn<DB[TB]>
  ],
  SelectedColumns extends SelectionColumn<DB, TB>[] | ['*'] = ['*'],
  ReturnCount = bigint,
  ReturnColumns extends SelectionColumn<DB, TB>[] | ['*'] = KeyColumns
> extends TableMapper<
  DB,
  TB,
  SelectedColumns,
  MappedObject,
  MappedObject,
  MappedObject | Partial<Insertable<DB[TB]>>,
  ReturnColumns,
  ReturnCount,
  true,
  true
> {
  /**
   * @param db The Kysely database instance.
   * @param tableName The name of the table.
   * @param options Options governing mapper behavior. Defaults to
   *  a key of `id`, to selecting all columns, and to returning
   *  the `id` on insert or update, when the caller requests returns.
   */
  constructor(
    db: Kysely<DB>,
    tableName: TB,
    options: UniformTableMapperOptions<
      DB,
      TB,
      MappedObject,
      KeyColumns,
      SelectedColumns,
      ReturnColumns,
      ReturnCount
    >
  ) {
    super(db, tableName, _prepareOptions(options) as any);
  }
}

/**
 * Provide default options.
 */
function _prepareOptions<
  DB,
  TB extends keyof DB & string,
  MappedObject extends object,
  KeyColumns extends SelectableColumnTuple<DB[TB]> | [],
  SelectedColumns extends SelectionColumn<DB, TB>[] | ['*'],
  ReturnCount,
  ReturnColumns extends SelectionColumn<DB, TB>[] | ['*']
>(
  options: UniformTableMapperOptions<
    DB,
    TB,
    MappedObject,
    KeyColumns,
    SelectedColumns,
    ReturnColumns,
    ReturnCount
  >
) {
  const keyColumns = options.keyColumns ?? DEFAULT_KEY;

  // Remove falsy key values from inserted object, by default
  const insertTransform = (obj: MappedObject) => {
    const insertedValues = { ...obj };
    keyColumns.forEach((column) => {
      if (!obj[column as keyof MappedObject]) {
        delete insertedValues[column as keyof MappedObject];
      }
    });
    return insertedValues;
  };

  // Add returned values to inserted object, by default
  const insertReturnTransform = (
    obj: MappedObject,
    returns: Selection<DB, TB, ReturnColumns[number]>
  ) => ({ ...obj, ...returns });

  // Use insert transform by default; or if none is provided, remove falsy
  // key values from inserted object if the object is a `MappedObject`.
  const updateTransform =
    options.insertTransform !== undefined
      ? options.insertTransform
      : (obj: MappedObject | Partial<Selectable<DB[TB]>>) =>
          options.isMappedObject(obj) ? insertTransform(obj as any) : obj;

  // If the object is a `MappedObject`, use the insert return transform by
  // default, or if none is provided, add returned values to inserted object.
  // If the object is not a `MappedObject`, return the raw return values.
  const updateReturnTransform = (
    obj: MappedObject,
    returns: Selection<DB, TB, ReturnColumns[number]>
  ) =>
    !options.isMappedObject(obj)
      ? returns
      : options.insertReturnTransform === undefined
      ? insertReturnTransform(obj, returns)
      : options.insertReturnTransform(obj, returns as any);

  return {
    keyColumns,
    insertTransform,
    insertReturnTransform,
    updateTransform,
    updateReturnTransform,
    returnColumns: keyColumns,
    ...options,
  };
}
