import { Insertable, Selectable, Updateable } from 'kysely';
import {
  ObjectWithKeys,
  SelectedRow,
  SelectionColumn,
} from '../../lib/type-utils';

/**
 * Options governing TableMapper behavior.
 * @typeparam DB Interface whose fields are table names defining tables.
 * @typeparam TB Name of the table.
 * @typeparam SelectedObject Type of objects returned by select queries.
 * @typeparam InsertedObject Type of objects inserted into the table.
 * @typeparam UpdaterObject Type of objects used to update rows of the table.
 * @typeparam ReturnColumns Columns to return from the table on insert or
 *  update, except when explicitly requesting no columns. `["*"]` returns
 *  all columns; `[]` returns none and is the default.
 * @typeparam ReturnedCount Type of count query results.
 * @typeparam ReturnedObject Objects to return from inserts and updates.
 */
export interface TableMapperOptions<
  DB,
  TB extends keyof DB & string,
  SelectedColumns extends SelectionColumn<DB, TB>[] | ['*'],
  SelectedObject extends object,
  InsertedObject extends object,
  UpdaterObject extends object,
  // TODO: update the following type to support aliases
  ReturnColumns extends (keyof Selectable<DB[TB]> & string)[] | ['*'],
  ReturnedCount,
  ReturnedObject extends object
> {
  /** Transformation to apply to inserted objects before insertion. */
  readonly insertTransform?: (obj: InsertedObject) => Insertable<DB[TB]>;

  /** Transformation to apply to objects provided for updating values. */
  readonly updaterTransform?: (update: UpdaterObject) => Updateable<DB[TB]>;

  /** Columns to return from selection queries. */
  readonly selectedColumns?: SelectedColumns;

  /** Transformation to apply to selected objects. */
  readonly selectTransform?: (
    row: SelectedRow<
      DB,
      TB,
      SelectedColumns extends ['*'] ? never : SelectedColumns[number],
      SelectedColumns
    >
  ) => SelectedObject;

  /**
   * Columns to return from the table on insert or update, unless explicitly
   * requesting no columns. `["*"]` returns all columns; `[]` returns none.
   */
  readonly returnColumns?: ReturnColumns;

  /** Transformation to apply to column values returned from inserts. */
  readonly insertReturnTransform?: (
    source: InsertedObject,
    returns: ObjectWithKeys<Selectable<DB[TB]>, ReturnColumns>
  ) => ReturnedObject;

  /** Transformation to apply to column values returned from updates. */
  readonly updateReturnTransform?: (
    source: UpdaterObject,
    returns: ObjectWithKeys<Selectable<DB[TB]>, ReturnColumns>
  ) => ReturnedObject;

  /** Transformation to apply to bigint count results. */
  readonly countTransform?: (count: bigint) => ReturnedCount;
}
