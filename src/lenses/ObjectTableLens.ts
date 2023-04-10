import { Insertable, Kysely, Selectable } from "kysely";

import { TableLens } from "./table-lens/table-lens";
import {
  KeyedObject,
  KeyedTableLens,
  SingleKeyValue,
  DEFAULT_KEY,
} from "./KeyedTableLens";
import {
  KeyTuple,
  ObjectWithKeys,
  SelectableColumn,
  SelectableColumnTuple,
  SelectionColumn,
} from "../lib/type-utils";
import { TableLensOptions } from "./table-lens/table-lens-options";

// TODO: catch query errors and provide helpful error messages

/**
 * Interface for table objects.
 */
export interface TableObject<
  T,
  PrimaryKeyColumns extends SelectableColumnTuple<T>
> extends Required<KeyedObject<T, PrimaryKeyColumns>> {
  getKey(): KeyTuple<T, PrimaryKeyColumns>;
}

/**
 * A lens for a table representing a store of objects, where each object has a
 * unique identifying key given by one or more primary key columns.
 * @typeparam DB The database type.
 * @typeparam TB The name of the table.
 * @typeparam MappedObject The type of the objects that are mapped to and from
 *  the table rows on inserts, updates, and selects.
 * @typeparam PrimaryKeyColumns Tuple of the names of the primary key columns.
 *  Defaults to `["id"]`.
 * @typeparam ReturnColumns The columns that are returned from the database
 *  when selecting or updating rows, for use when creating the mapped objects.
 *  `["*"]` returns all columns; `[]` returns none. Defaults to `PrimaryKeyColumns`.
 * @typeparam ReturnedCount Type of count query results.
 */
export class ObjectTableLens<
  DB,
  TB extends keyof DB & string,
  MappedObject extends TableObject<DB[TB], PrimaryKeyColumns>,
  PrimaryKeyColumns extends SelectableColumnTuple<DB[TB]> = [
    "id" & SelectableColumn<DB[TB]>
  ],
  SelectedColumns extends SelectionColumn<DB, TB>[] | ["*"] = ["*"],
  ReturnColumns extends
    | (keyof Selectable<DB[TB]> & string)[]
    | ["*"] = PrimaryKeyColumns,
  ReturnedCount = bigint
> extends TableLens<
  DB,
  TB,
  SelectedColumns,
  MappedObject,
  MappedObject,
  Partial<Insertable<DB[TB]>>,
  ReturnColumns,
  ReturnedCount,
  MappedObject
> {
  protected keyedTableLens: KeyedTableLens<
    DB,
    TB,
    PrimaryKeyColumns,
    SelectedColumns,
    MappedObject,
    MappedObject,
    MappedObject,
    ReturnColumns,
    ReturnedCount
  >;

  /**
   * Create a new ObjectTableLens.
   * @param db The Kysely database instance.
   * @param tableName The name of the table.
   * @param primaryKeyColumns The names of the primary key columns.
   * @param options Options governing ObjectTableLens behavior.
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
    primaryKeyColumns: Readonly<PrimaryKeyColumns> = DEFAULT_KEY as any,
    options: TableLensOptions<
      DB,
      TB,
      SelectedColumns,
      MappedObject,
      MappedObject,
      MappedObject,
      ReturnColumns,
      ReturnedCount,
      MappedObject
    > = {}
  ) {
    super(
      db,
      tableName,
      _prepareBaseOptions(primaryKeyColumns, options) as any
    );
    this.keyedTableLens = new KeyedTableLens(db, tableName, primaryKeyColumns, {
      ...this.options,
      updaterTransform: options.updaterTransform,
      updateReturnTransform:
        options.updateReturnTransform ?? this.options.insertReturnTransform,
    } as any);
  }

  /**
   * Delete the row for the object having the given key.
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
    return this.keyedTableLens.deleteByKey(key);
  }

  /**
   * Select the object for the row having the given key.
   * @param key The key of the row to select. If there is only one primary
   *  key column, this can be the value of the key. Otherwise, this must be
   *  a tuple of the key values.
   * @returns An object for the row, or null if no row was found.
   */
  selectByKey(
    key:
      | SingleKeyValue<DB[TB], PrimaryKeyColumns>
      | Readonly<KeyTuple<DB[TB], PrimaryKeyColumns>>
  ): Promise<MappedObject | null> {
    return this.keyedTableLens.selectByKey(key);
  }

  /**
   * Updates an existing row from the provided object, identifying the row
   * by the object's key, returning the object updated for returned columns.
   * @param obj Object to update.
   * @returns Returns an object for the row, possibly transformed, or null if
   *  no row was found; returns nothing (void) if `returnColumns` is empty.
   *  Use `updateNoReturns` if there are no return columns.
   */
  update(
    obj: MappedObject
  ): Promise<ReturnColumns extends [] ? void : MappedObject | null>;

  async update(obj: MappedObject): Promise<MappedObject | null | void> {
    // TODO: temporary "as any" cast
    return this.keyedTableLens.updateByKey(obj.getKey(), obj) as any;
  }

  /**
   * Updates an existing row from the provided object, identifying the row
   * by the object's key, without returning an updated object.
   * @param obj Object to update.
   * @returns True if a row was updated, false otherwise.
   */
  async updateNoReturns(obj: MappedObject): Promise<boolean> {
    return this.keyedTableLens.updateByKeyNoReturns(obj.getKey(), obj);
  }
}

/**
 * Provide default transformations for the base TableLens.
 */
function _prepareBaseOptions<
  DB,
  TB extends keyof DB & string,
  MappedObject extends TableObject<DB[TB], PrimaryKeyColumns>,
  PrimaryKeyColumns extends SelectableColumnTuple<DB[TB]>,
  SelectedColumns extends SelectionColumn<DB, TB>[] | ["*"],
  ReturnedCount,
  ReturnColumns extends (keyof Selectable<DB[TB]> & string)[] | ["*"]
>(
  primaryKeyColumns: Readonly<PrimaryKeyColumns>,
  options: TableLensOptions<
    DB,
    TB,
    SelectedColumns,
    MappedObject,
    MappedObject,
    MappedObject,
    ReturnColumns,
    ReturnedCount,
    MappedObject
  >
) {
  const baseOptions = {
    insertTransform: (obj: MappedObject) => {
      const insertion = { ...obj };
      primaryKeyColumns.forEach((column) => {
        if (!obj[column as keyof MappedObject]) {
          delete insertion[column as keyof MappedObject];
        }
      });
      return insertion;
    },
    insertReturnTransform: (
      obj: MappedObject,
      returns: ObjectWithKeys<Selectable<DB[TB]>, ReturnColumns>
    ) => {
      return { ...obj, ...returns };
    },
    returnColumns: primaryKeyColumns,
    ...options,
  };
  // Base update methods operate on columns, not the mapped object.
  delete baseOptions["updaterTransform"];
  delete baseOptions["updateReturnTransform"];
  return baseOptions;
}
