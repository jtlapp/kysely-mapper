import { Insertable, Kysely, Selectable } from 'kysely';

import { TableMapper } from './table-mapper';
import {
  ObjectWithKeys,
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
 * A mapper for a table representing a store of objects, where each object has a
 * unique identifying key given by one or more primary key columns.
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
 * @typeparam ReturnedCount Type of count query results.
 */
export class UniformTableMapper<
  DB,
  TB extends keyof DB & string,
  MappedObject extends object,
  PrimaryKeyColumns extends SelectableColumnTuple<DB[TB]> = [
    'id' & SelectableColumn<DB[TB]>
  ],
  SelectedColumns extends SelectionColumn<DB, TB>[] | ['*'] = ['*'],
  ReturnColumns extends
    | (keyof Selectable<DB[TB]> & string)[]
    | ['*'] = PrimaryKeyColumns,
  ReturnedCount = bigint
> extends TableMapper<
  DB,
  TB,
  SelectedColumns,
  MappedObject,
  MappedObject,
  MappedObject | Partial<Insertable<DB[TB]>>,
  ReturnColumns,
  ReturnedCount,
  MappedObject
> {
  // TODO: rewrite
  /**
   * Create a new UniformTableMapper.
   * @param db The Kysely database instance.
   * @param tableName The name of the table.
   * @param primaryKeyColumns The names of the primary key columns.
   * @param options Options governing UniformTableMapper behavior.
   *  `insertTransform` defaults to a transform that removes the primary key
   *  columns whose values are falsy. `insertReturnTransform` defaults to a
   *  transform that adds the return columns. The update transforms only
   *  apply to `update()` and `updateNoReturns()`; `updateWhere()` and
   *  `updateCount()` accept and return individual columns, not `MappedObject`.
   *  `updateReturnTransform` defaults to the `insertReturnTransform`.
   */
  constructor(
    db: Kysely<DB>,
    tableName: TB,
    options: UniformTableMapperOptions<
      DB,
      TB,
      MappedObject,
      PrimaryKeyColumns,
      SelectedColumns,
      ReturnColumns,
      ReturnedCount
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
  PrimaryKeyColumns extends SelectableColumnTuple<DB[TB]>,
  SelectedColumns extends SelectionColumn<DB, TB>[] | ['*'],
  ReturnedCount,
  ReturnColumns extends (keyof Selectable<DB[TB]> & string)[] | ['*']
>(
  options: UniformTableMapperOptions<
    DB,
    TB,
    MappedObject,
    PrimaryKeyColumns,
    SelectedColumns,
    ReturnColumns,
    ReturnedCount
  >
) {
  const primaryKeyColumns = options.primaryKeyColumns ?? DEFAULT_KEY;

  const insertTransform = (obj: MappedObject) => {
    const insertedValues = { ...obj };
    primaryKeyColumns.forEach((column) => {
      if (!obj[column as keyof MappedObject]) {
        delete insertedValues[column as keyof MappedObject];
      }
    });
    return insertedValues;
  };

  const updateTransform = (obj: MappedObject | Partial<Selectable<DB[TB]>>) => {
    // Not using a type guard because it complicates the options assignment
    options.isMappedObject(obj) ? insertTransform(obj as any) : obj;
  };

  const returnTransform = (
    obj: MappedObject,
    returns: ObjectWithKeys<Selectable<DB[TB]>, ReturnColumns>
  ) => {
    return { ...obj, ...returns };
  };

  return {
    primaryKeyColumns,
    insertTransform,
    insertReturnTransform: returnTransform,
    updateTransform,
    updateReturnTransform: returnTransform,
    returnColumns: primaryKeyColumns,
    ...options,
  };
}
