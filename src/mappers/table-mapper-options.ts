import { Insertable, Selectable, Updateable } from 'kysely';
import {
  ObjectWithKeys,
  SelectedRow,
  SelectionColumn,
} from '../lib/type-utils';

/**
 * Options governing TableMapper behavior.
 * @typeparam DB Interface whose fields are table names defining tables.
 * @typeparam TB Name of the table.
 * @typeparam SelectedObject Type of objects returned by select queries.
 * @typeparam InsertedObject Type of objects inserted into the table.
 * @typeparam UpdatingObject Type of objects used to update rows of the table.
 * @typeparam ReturnColumns Columns to return from the table on insert or
 *  update, except when explicitly requesting no columns. `['*']` returns
 *  all columns; `[]` returns none and is the default.
 * @typeparam ReturnCount Type of count query results.
 * @typeparam InsertReturnsSelectedObject Whether insert queries return
 *  `SelectedObject` or `DefaultReturnObject`.
 * @typeparam UpdateReturnsSelectedObjectWhenProvided Whether update queries
 *  return `SelectedObject` when the updating object is a `SelectedObject`;
 *  update queries otherwise return `DefaultReturnObject`.
 * @typeparam DefaultReturnObject Type of objects returned from inserts and
 *  updates, unless configured to return `SelectedObject`.
 */
export interface TableMapperOptions<
  DB,
  TB extends keyof DB & string,
  SelectedColumns extends SelectionColumn<DB, TB>[] | ['*'] = ['*'],
  SelectedObject extends object = SelectedRow<
    DB,
    TB,
    SelectedColumns extends ['*'] ? never : SelectedColumns[number],
    SelectedColumns
  >,
  InsertedObject extends object = Insertable<DB[TB]>,
  UpdatingObject extends object = Partial<Insertable<DB[TB]>>,
  // TODO: support aliases in ReturnColumns and test
  ReturnColumns extends (keyof Selectable<DB[TB]> & string)[] | ['*'] = [],
  ReturnCount = bigint,
  InsertReturnsSelectedObject extends boolean = false,
  UpdateReturnsSelectedObjectWhenProvided extends boolean = false,
  DefaultReturnObject extends object = ReturnColumns extends ['*']
    ? Selectable<DB[TB]>
    : ObjectWithKeys<Selectable<DB[TB]>, ReturnColumns>
> {
  /** Transformation to apply to inserted objects before insertion. */
  readonly insertTransform?: (obj: InsertedObject) => Insertable<DB[TB]>;

  /** Whether insert queries return `SelectedObject` or `DefaultReturnObject`. */
  // TODO: do I need this? can it be properly inferred?
  readonly insertReturnsSelectedObject?: InsertReturnsSelectedObject;

  /** Transformation to apply to objects provided for updating values. */
  readonly updateTransform?: (update: UpdatingObject) => Updateable<DB[TB]>;

  /**
   * Whether update queries return `SelectedObject` when the updating object
   * is a `SelectedObject`; update queries otherwise return `DefaultReturnObject`.
   */
  // TODO: do I need this? can it be properly inferred?
  readonly updateReturnsSelectedObjectWhenProvided?: UpdateReturnsSelectedObjectWhenProvided;

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
   * requesting no columns. `['*']` returns all columns; `[]` returns none.
   */
  readonly returnColumns?: ReturnColumns;

  /** Transformation to apply to column values returned from inserts. */
  readonly insertReturnTransform?: (
    source: InsertedObject,
    returns: ReturnColumns extends []
      ? never
      : ObjectWithKeys<Selectable<DB[TB]>, ReturnColumns>
  ) => InsertReturnsSelectedObject extends true
    ? SelectedObject
    : DefaultReturnObject;

  /** Transformation to apply to column values returned from updates. */
  readonly updateReturnTransform?: (
    source: UpdatingObject,
    returns: ObjectWithKeys<Selectable<DB[TB]>, ReturnColumns>
  ) => UpdateReturnsSelectedObjectWhenProvided extends true
    ? UpdatingObject extends SelectedObject
      ? SelectedObject
      : DefaultReturnObject
    : DefaultReturnObject;

  /** Transformation to apply to bigint count results. */
  readonly countTransform?: (count: bigint) => ReturnCount;
}
