import {
  Insertable,
  Kysely,
  ReferenceExpression,
  Selectable,
  WhereInterface,
} from 'kysely';

import { QueryFilter } from '../lib/query-filter';
import {
  KeyTuple,
  ObjectWithKeys,
  SelectableColumn,
  SelectableColumnTuple,
  SelectedRow,
  SelectionColumn,
} from '../lib/type-utils';
import { TableMapper } from './table-mapper';
import { TableMapperOptions } from './table-mapper-options';

/** Default key columns */
export const DEFAULT_KEY = ['id'] as const;

// TODO: Make all modifiable structures readonly when possible.

/**
 * Type of the primary key, when there is only one primary key.
 * @typeparam T Table interface.
 * @typeparam KA Array of the primary key column names.
 */
export type SingleKeyValue<
  T,
  KA extends (keyof Selectable<T> & string)[]
> = KA extends [any] ? Selectable<T>[KA[0]] : never;

/**
 * Interface that updater objects must implement to provide a key, if
 * the key is not to be taken directly from the object's properties.
 * @typeparam T Table interface.
 * @typeparam KeyColumns Array of the primary key column names.
 */
export interface KeyedObject<T, KeyColumns extends SelectableColumnTuple<T>> {
  getKey?: () => KeyTuple<T, KeyColumns>;
}

/**
 * Mapper for a table with compound primary key.
 * @typeparam DB Interface whose fields are table names defining tables.
 * @typeparam TB Name of the table.
 * @typeparam PrimaryKeyColumns Arrayof names of the primary key columns.
 * @typeparam SelectedObject Type of objects returned by select queries.
 * @typeparam InsertedObject Type of objects inserted into the table.
 * @typeparam UpdaterObject Type of objects used to update rows of the table.
 * @typeparam ReturnColumns Columns to return from the table on insert or
 *  update, except when explicitly requesting no columns. `["*"]` returns
 *  all columns; `[]` returns none. Defaults to `PrimaryKeyColumns`.
 * @typeparam ReturnedCount Type of count query results.
 * @typeparam ReturnedObject Objects to return from inserts and updates.
 */
export class KeyedTableMapper<
  DB,
  TB extends keyof DB & string,
  PrimaryKeyColumns extends SelectableColumnTuple<DB[TB]> = [
    'id' & SelectableColumn<DB[TB]>
  ],
  SelectedColumns extends SelectionColumn<DB, TB>[] | ['*'] = ['*'],
  SelectedObject extends object = SelectedRow<
    DB,
    TB,
    SelectedColumns extends ['*'] ? never : SelectedColumns[number],
    SelectedColumns
  >,
  InsertedObject extends object = Insertable<DB[TB]>,
  UpdaterObject extends object &
    Partial<KeyedObject<DB[TB], PrimaryKeyColumns>> = Partial<
    Insertable<DB[TB]>
  >,
  ReturnColumns extends
    | (keyof Selectable<DB[TB]> & string)[]
    | ['*'] = PrimaryKeyColumns,
  ReturnedCount = bigint,
  ReturnedObject extends object = ReturnColumns extends ['*']
    ? Selectable<DB[TB]>
    : ObjectWithKeys<Selectable<DB[TB]>, ReturnColumns>
> extends TableMapper<
  DB,
  TB,
  SelectedColumns,
  SelectedObject,
  InsertedObject,
  UpdaterObject,
  ReturnColumns,
  ReturnedCount,
  ReturnedObject
> {
  /**
   * Constructs a new keyed table mapper.
   * @param db The Kysely database.
   * @param tableName The name of the table.
   * @param primaryKeyColumns The names of the primary key columns,
   *  expressed as a tuplet. Defaults to `["id"]`.
   * @param options Options governing mapper behavior. `returnColumns`
   *  defaults to returning the key columns.
   */
  constructor(
    db: Kysely<DB>,
    tableName: TB,
    readonly primaryKeyColumns: Readonly<PrimaryKeyColumns> = DEFAULT_KEY as any,
    options: TableMapperOptions<
      DB,
      TB,
      SelectedColumns,
      SelectedObject,
      InsertedObject,
      UpdaterObject,
      ReturnColumns,
      ReturnedCount,
      ReturnedObject
    > = {}
  ) {
    super(db, tableName, _prepareOptions(options, primaryKeyColumns) as any);
  }

  /**
   * Delete the row having the given key.
   * @param key The key of the row to delete. If there is only one primary
   *  key column, this can be the value of the key. Otherwise, this must be
   * a tuple of the key values.
   * @returns True if a row was deleted, false otherwise.
   */
  async deleteByKey(
    key:
      | SingleKeyValue<DB[TB], PrimaryKeyColumns>
      | Readonly<KeyTuple<DB[TB], PrimaryKeyColumns>>
  ): Promise<boolean> {
    const count = await this.deleteWhere(this.filterForKey(key));
    return count == 1;
  }

  /**
   * Select the row having the given key.
   * @param key The key of the row to select. If there is only one primary
   *  key column, this can be the value of the key. Otherwise, this must be
   *  a tuple of the key values.
   * @returns An object for the row, or null if no row was found.
   */
  selectByKey(
    key:
      | SingleKeyValue<DB[TB], PrimaryKeyColumns>
      | Readonly<KeyTuple<DB[TB], PrimaryKeyColumns>>
  ): Promise<SelectedObject | null> {
    return this.select(this.filterForKey(key)).getOne();
  }

  /**
   * Update the row having the given key. Retrieves the columns specified in
   * the `returnColumns` option, returning them unless `updateReturnTransform`
   * transforms them into `ReturnedObject`. If `returnColumns` is empty,
   * returns nothing.
   * @param key The key of the row to update. If there is only one primary
   *  key column, this can be the value of the key. Otherwise, this must be
   *  a tuple of the key values.
   * @param obj Object containing the fields to update. The key of the row
   *  to update is taken from this object.
   * @returns Returns an object for the row, possibly transformed, or null if
   *  no row was found; returns nothing (void) if `returnColumns` is empty.
   *  Use `updateByKeyNoReturns` if there are no return columns.
   * @see this.updateByKeyNoReturns
   */
  updateByKey(
    key:
      | SingleKeyValue<DB[TB], PrimaryKeyColumns>
      | Readonly<KeyTuple<DB[TB], PrimaryKeyColumns>>,
    obj: UpdaterObject
  ): Promise<ReturnColumns extends [] ? void : ReturnedObject | null>;

  async updateByKey(
    key:
      | SingleKeyValue<DB[TB], PrimaryKeyColumns>
      | Readonly<KeyTuple<DB[TB], PrimaryKeyColumns>>,
    obj: UpdaterObject
  ): Promise<ReturnedObject | null | void> {
    const updates = await this.updateWhere(this.filterForKey(key), obj as any);
    if (updates !== undefined) {
      return updates.length == 0 ? null : updates[0];
    }
  }

  /**
   * Update the row having the given key, without returning any columns.
   * @param key The key of the row to update. If there is only one primary
   *  key column, this can be the value of the key. Otherwise, this must be
   *  a tuple of the key values.
   * @param obj Object containing the fields to update. The key of the row
   *  to update is taken from this object.
   * @returns True if a row was updated, false otherwise.
   */
  async updateByKeyNoReturns(
    key:
      | SingleKeyValue<DB[TB], PrimaryKeyColumns>
      | Readonly<KeyTuple<DB[TB], PrimaryKeyColumns>>,
    obj: UpdaterObject
  ): Promise<boolean> {
    const updateCount = await this.updateCount(
      this.filterForKey(key),
      obj as any
    );
    return updateCount == 1;
  }

  /**
   * Returns a filter that restricts a query to the provided key.
   * @param key The key to filter by.
   * @returns A filter that restricts a query to the provided key.
   */
  protected filterForKey<QB extends WhereInterface<any, any>>(
    key:
      | SingleKeyValue<DB[TB], PrimaryKeyColumns>
      | Readonly<KeyTuple<DB[TB], PrimaryKeyColumns>>
  ): QueryFilter<DB, TB, ReferenceExpression<DB, TB>, QB> {
    if (Array.isArray(key)) {
      return ({ and, cmpr }) =>
        and(
          this.primaryKeyColumns.map((columnName, i) =>
            cmpr(
              this.ref(columnName),
              '=',
              (key as KeyTuple<DB[TB], PrimaryKeyColumns>)[i]
            )
          )
        );
    }
    return [this.ref(this.primaryKeyColumns[0]), '=', key];
  }
}

/**
 * Default `returnColumns` to the primary keys.
 */
function _prepareOptions<
  DB,
  TB extends keyof DB & string,
  ReturnedCount,
  PrimaryKeyColumns extends Readonly<(keyof Selectable<DB[TB]> & string)[]>,
  SelectedColumns extends SelectionColumn<DB, TB>[] | ['*'],
  SelectedObject extends object,
  InsertedObject extends object,
  UpdaterObject extends object,
  ReturnColumns extends (keyof Selectable<DB[TB]> & string)[] | ['*'],
  ReturnedObject extends object
>(
  options: TableMapperOptions<
    DB,
    TB,
    SelectedColumns,
    SelectedObject,
    InsertedObject,
    UpdaterObject,
    ReturnColumns,
    ReturnedCount,
    ReturnedObject
  >,
  primaryKeyColumns: PrimaryKeyColumns
) {
  return {
    returnColumns: primaryKeyColumns,
    ...options,
  };
}
