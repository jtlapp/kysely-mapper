import { Kysely, Selectable, Selection, Updateable } from 'kysely';

import { AbstractTableMapper } from './abstract-table-mapper';
import {
  SelectableColumn,
  SelectableColumnTuple,
  SelectedRow,
  SelectionColumn,
} from '../lib/type-utils';
import { UniformTableMapperSettings } from './uniform-table-mapper-settings';
import { TableMapperTransforms } from './table-mapper-transforms';

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
> extends AbstractTableMapper<
  DB,
  TB,
  KeyColumns,
  SelectedColumns,
  MappedObject,
  MappedObject,
  MappedObject | Updateable<DB[TB]>,
  ReturnCount,
  ReturnColumns,
  true,
  true
> {
  declare settings: UniformTableMapperSettings<
    DB,
    TB,
    KeyColumns,
    SelectedColumns,
    ReturnColumns
  >;
  declare transforms: TableMapperTransforms<
    DB,
    TB,
    KeyColumns,
    SelectedColumns,
    MappedObject,
    MappedObject,
    MappedObject | Updateable<DB[TB]>,
    ReturnCount,
    ReturnColumns,
    true,
    true
  >;

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
    settings: UniformTableMapperSettings<
      DB,
      TB,
      KeyColumns,
      SelectedColumns,
      ReturnColumns
    >
  ) {
    super(db, tableName, _prepareSettings(settings));
    this.transforms = _prepareTransforms(
      this.keyColumns,
      this.settings.isMappedObject,
      {}
    );
  }

  /**
   * Returns a new table mapper that uses the provided transformations.
   * @param transforms The transforms to use.
   * @returns A new table mapper that uses the provided transforms.
   */
  withTransforms<
    MappedObject extends object,
    ReturnCount = bigint,
    DefaultReturnObject extends object = ReturnColumns extends ['*']
      ? Selectable<DB[TB]>
      : Selection<DB, TB, ReturnColumns[number]>
  >(
    transforms: Readonly<
      TableMapperTransforms<
        DB,
        TB,
        KeyColumns,
        SelectedColumns,
        MappedObject,
        MappedObject,
        MappedObject | Updateable<DB[TB]>,
        ReturnCount,
        ReturnColumns,
        true,
        true,
        DefaultReturnObject
      >
    >
  ) {
    const transformingTableMapper = new UniformTableMapper<
      DB,
      TB,
      MappedObject,
      KeyColumns,
      SelectedColumns,
      ReturnCount,
      ReturnColumns
    >(this.db, this.tableName, this.settings);

    transformingTableMapper.transforms = _prepareTransforms(
      this.keyColumns,
      this.settings.isMappedObject,
      transforms
    );
    return transformingTableMapper;
  }
}

/**
 * Provide default settings.
 */
function _prepareSettings<
  DB,
  TB extends keyof DB & string,
  KeyColumns extends SelectableColumnTuple<DB[TB]> | [],
  SelectedColumns extends SelectionColumn<DB, TB>[] | ['*'],
  ReturnColumns extends SelectionColumn<DB, TB>[] | ['*']
>(
  settings: UniformTableMapperSettings<
    DB,
    TB,
    KeyColumns,
    SelectedColumns,
    ReturnColumns
  >
) {
  const keyColumns = settings.keyColumns ?? DEFAULT_KEY;

  return {
    keyColumns,
    returnColumns: keyColumns,
    ...settings,
  } as UniformTableMapperSettings<
    DB,
    TB,
    KeyColumns,
    SelectedColumns,
    ReturnColumns
  >;
}

/**
 * Provides default transforms.
 */
function _prepareTransforms<
  DB,
  TB extends keyof DB & string,
  KeyColumns extends SelectableColumnTuple<DB[TB]> | [],
  SelectedColumns extends SelectionColumn<DB, TB>[] | ['*'],
  MappedObject extends object,
  ReturnCount,
  ReturnColumns extends SelectionColumn<DB, TB>[] | ['*'],
  DefaultReturnObject extends object
>(
  keyColumns: KeyColumns,
  isMappedObject: (obj: any) => boolean,
  transforms: TableMapperTransforms<
    DB,
    TB,
    KeyColumns,
    SelectedColumns,
    MappedObject,
    MappedObject,
    MappedObject | Updateable<DB[TB]>,
    ReturnCount,
    ReturnColumns,
    true,
    true,
    DefaultReturnObject
  >
) {
  // Remove falsy key values from inserted object, by default
  const insertTransform = (obj: MappedObject) => {
    const insertedValues = { ...obj };
    keyColumns.forEach((column) => {
      if (!obj[column as unknown as keyof MappedObject]) {
        delete insertedValues[column as unknown as keyof MappedObject];
      }
    });
    return insertedValues;
  };

  // Add returned values to inserted object, by default
  const insertReturnTransform = (
    obj: MappedObject,
    returns: ReturnColumns extends []
      ? never
      : SelectedRow<
          DB,
          TB,
          ReturnColumns extends ['*'] ? never : ReturnColumns[number],
          ReturnColumns
        >
  ) => ({ ...obj, ...returns });

  // Use insert transform by default; or if none is provided, remove falsy
  // key values from inserted object if the object is a `MappedObject`.
  const updateTransform =
    transforms.insertTransform !== undefined
      ? transforms.insertTransform
      : (obj: MappedObject | Updateable<DB[TB]>) =>
          isMappedObject(obj) ? insertTransform(obj as any) : obj;

  // If the object is a `MappedObject`, use the insert return transform by
  // default, or if none is provided, add returned values to inserted object.
  // If the object is not a `MappedObject`, return the raw return values.
  const updateReturnTransform = (
    obj: MappedObject | Updateable<DB[TB]>,
    returns: ReturnColumns extends []
      ? never
      : SelectedRow<
          DB,
          TB,
          ReturnColumns extends ['*'] ? never : ReturnColumns[number],
          ReturnColumns
        >
  ) =>
    !isMappedObject(obj)
      ? returns
      : transforms.insertReturnTransform === undefined
      ? insertReturnTransform(obj as MappedObject, returns)
      : transforms.insertReturnTransform(obj as MappedObject, returns as any);

  return {
    insertTransform,
    insertReturnTransform,
    updateTransform,
    updateReturnTransform,
    ...transforms,
  } as TableMapperTransforms<
    DB,
    TB,
    KeyColumns,
    SelectedColumns,
    MappedObject,
    MappedObject,
    MappedObject | Updateable<DB[TB]>,
    ReturnCount,
    ReturnColumns,
    true,
    true
  >;
}
