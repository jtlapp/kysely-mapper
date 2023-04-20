import { Kysely } from 'kysely';

import { AbstractTableMapper } from './abstract-table-mapper';
import {
  RequireSome,
  SelectableColumn,
  SelectableColumnTuple,
  SelectionColumn,
} from '../lib/type-utils';
import { TableMapperSettings } from './table-mapper-settings';
import { TableMapperTransforms } from './table-mapper-transforms';
import { DefaultUniformTransforms } from './default-uniform-transforms';

/** Default key columns */
export const DEFAULT_KEY = ['id'] as const;

type RequiredTransforms =
  | 'insertTransform'
  | 'insertReturnTransform'
  | 'updateTransform'
  | 'updateReturnTransform'
  | 'selectTransform';

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
  UpdateReturnColumns extends Readonly<SelectionColumn<DB, TB>[]> | ['*'] = []
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
  MappedObject
> {
  declare settings: TableMapperSettings<
    DB,
    TB,
    KeyColumns,
    SelectedColumns,
    InsertReturnColumns,
    UpdateReturnColumns
  >;
  declare transforms: RequireSome<
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
      MappedObject
    >,
    RequiredTransforms
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
    settings: TableMapperSettings<
      DB,
      TB,
      KeyColumns,
      SelectedColumns,
      InsertReturnColumns,
      UpdateReturnColumns
    >
  ) {
    super(db, tableName, _prepareSettings(settings));
  }

  /**
   * Returns a new uniform table mapper that uses default transformations.
   * @returns A new uniform table mapper that uses default transforms.
   */
  withDefaultTransforms() {
    return this.withTransforms(new DefaultUniformTransforms(this.keyColumns));
  }

  /**
   * Returns a new uniform table mapper that uses the provided transformations.
   * @param transforms The transforms to use.
   * @returns A new uniform table mapper that uses the provided transforms.
   */
  withTransforms<MappedObject extends object, ReturnCount = bigint>(
    transforms: Readonly<
      RequireSome<
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
          MappedObject
        >,
        RequiredTransforms
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
      UpdateReturnColumns
    >(this.db, this.tableName, this.settings);

    transformingTableMapper.transforms = transforms;
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
  settings: TableMapperSettings<
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
  } as TableMapperSettings<
    DB,
    TB,
    KeyColumns,
    SelectedColumns,
    InsertReturnColumns,
    UpdateReturnColumns
  >;
}
