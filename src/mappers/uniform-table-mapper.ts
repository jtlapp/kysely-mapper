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
 * @typeparam InsertReturnColumns Columns to return from the table on insert
 *  queries that return columns. `['*']` returns all columns; `[]` returns
 *  none. May specify aliases. Defaults to `KeyColumns`.
 * @typeparam UpdateReturnColumns Columns to return from the table on update
 *  queries that return columns. `['*']` returns all columns; `[]` returns
 *  none and is the default. May specify aliases.
 */
export class UniformTableMapper<
  DB,
  TB extends keyof DB & string,
  MappedObject extends object,
  KeyColumns extends Readonly<SelectableColumnTuple<DB[TB]>> | [] = [
    'id' & SelectableColumn<DB[TB]>
  ],
  SelectedColumns extends Readonly<SelectionColumn<DB, TB>[]> | ['*'] = ['*'],
  ReturnCount = bigint,
  InsertReturnColumns extends
    | Readonly<SelectionColumn<DB, TB>[]>
    | ['*'] = Readonly<KeyColumns>,
  UpdateReturnColumns extends Readonly<SelectionColumn<DB, TB>[]> | ['*'] = [],
  UpdateReturn = UpdateReturnColumns extends ['*']
    ? Selectable<DB[TB]>
    : Selection<DB, TB, UpdateReturnColumns[number]>
> extends AbstractTableMapper<
  DB,
  TB,
  KeyColumns,
  SelectedColumns,
  MappedObject,
  MappedObject,
  MappedObject,
  ReturnCount,
  InsertReturnColumns,
  UpdateReturnColumns,
  MappedObject,
  UpdateReturn
> {
  declare settings: UniformTableMapperSettings<
    DB,
    TB,
    KeyColumns,
    SelectedColumns,
    InsertReturnColumns,
    UpdateReturnColumns
  >;
  declare transforms: TableMapperTransforms<
    DB,
    TB,
    KeyColumns,
    SelectedColumns,
    MappedObject,
    MappedObject,
    MappedObject,
    ReturnCount,
    InsertReturnColumns,
    UpdateReturnColumns,
    MappedObject,
    UpdateReturn
  >;

  /**
   * @param db The Kysely database instance.
   * @param tableName The name of the table.
   * @param options Options governing table mapper behavior. Defaults to a key
   *  of `id`, to selecting all columns, and to returning the `id` on insert
   *  or update, when the caller requests returns.
   */
  constructor(
    db: Kysely<DB>,
    tableName: TB,
    settings: UniformTableMapperSettings<
      DB,
      TB,
      KeyColumns,
      SelectedColumns,
      InsertReturnColumns,
      UpdateReturnColumns
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
   * Returns a new uniform table mapper that uses the provided transformations.
   * @param transforms The transforms to use.
   * @returns A new uniform table mapper that uses the provided transforms.
   */
  withTransforms<MappedObject extends object, ReturnCount = bigint>(
    transforms: Readonly<
      TableMapperTransforms<
        DB,
        TB,
        KeyColumns,
        SelectedColumns,
        MappedObject,
        MappedObject,
        MappedObject,
        ReturnCount,
        InsertReturnColumns,
        UpdateReturnColumns,
        MappedObject,
        UpdateReturn
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
      InsertReturnColumns,
      UpdateReturnColumns,
      UpdateReturn
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
  KeyColumns extends Readonly<SelectableColumnTuple<DB[TB]>> | [],
  SelectedColumns extends Readonly<SelectionColumn<DB, TB>[]> | ['*'],
  InsertReturnColumns extends Readonly<SelectionColumn<DB, TB>[]> | ['*'],
  UpdateReturnColumns extends Readonly<SelectionColumn<DB, TB>[]> | ['*']
>(
  settings: UniformTableMapperSettings<
    DB,
    TB,
    KeyColumns,
    SelectedColumns,
    InsertReturnColumns,
    UpdateReturnColumns
  >
) {
  const keyColumns = settings.keyColumns ?? DEFAULT_KEY;

  return {
    keyColumns,
    insertReturnColumns: keyColumns,
    ...settings,
  } as UniformTableMapperSettings<
    DB,
    TB,
    KeyColumns,
    SelectedColumns,
    InsertReturnColumns,
    UpdateReturnColumns
  >;
}

/**
 * Provides default transforms.
 */
function _prepareTransforms<
  DB,
  TB extends keyof DB & string,
  KeyColumns extends Readonly<SelectableColumnTuple<DB[TB]>> | [],
  SelectedColumns extends Readonly<SelectionColumn<DB, TB>[]> | ['*'],
  MappedObject extends object,
  ReturnCount,
  InsertReturnColumns extends Readonly<SelectionColumn<DB, TB>[]> | ['*'],
  UpdateReturnColumns extends Readonly<SelectionColumn<DB, TB>[]> | ['*'],
  UpdateReturn
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
    MappedObject,
    ReturnCount,
    InsertReturnColumns,
    UpdateReturnColumns,
    MappedObject,
    UpdateReturn
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
    returns: InsertReturnColumns extends []
      ? never
      : SelectedRow<
          DB,
          TB,
          InsertReturnColumns extends ['*']
            ? never
            : InsertReturnColumns[number],
          InsertReturnColumns
        >
  ) => ({ ...obj, ...returns });

  // Use insert transform by default; or if none is provided, remove falsy
  // key values from inserted object if the object is a `MappedObject`.
  const updateTransform =
    transforms.updateTransform !== undefined
      ? transforms.updateTransform
      : (obj: MappedObject | Updateable<DB[TB]>) =>
          isMappedObject(obj) ? insertTransform(obj as any) : obj;

  return {
    insertTransform,
    insertReturnTransform,
    updateTransform,
    ...transforms,
  } as TableMapperTransforms<
    DB,
    TB,
    KeyColumns,
    SelectedColumns,
    MappedObject,
    MappedObject,
    MappedObject,
    ReturnCount,
    InsertReturnColumns,
    UpdateReturnColumns,
    MappedObject,
    UpdateReturn
  >;
}
