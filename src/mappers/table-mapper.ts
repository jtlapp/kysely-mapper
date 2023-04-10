import {
  Kysely,
  Insertable,
  ReferenceExpression,
  Selectable,
  Updateable,
  InsertQueryBuilder,
  InsertResult,
  SelectQueryBuilder,
  Selection,
} from 'kysely';

// TODO: look at replace [*] with an AllColumns symbol

import { QueryFilter, applyQueryFilter } from '../lib/query-filter';
import {
  ObjectWithKeys,
  SelectedRow,
  SelectionColumn,
} from '../lib/type-utils';
import { TableMapperOptions } from './table-mapper-options';
import { DeletionQuery } from '../queries/deletion-query';
import { RowConverter } from '../lib/row-converter';
import { SelectionQuery } from '../queries/selection-query';
import { AllSelection } from '../lib/kysely-types';

type DeleteQB<DB, TB extends keyof DB & string> = ReturnType<
  TableMapper<DB, TB, any>['deleteQB']
>;
type UpdateQB<DB, TB extends keyof DB & string> = ReturnType<
  TableMapper<DB, TB, any>['updateQB']
>;

/**
 * A mapper providing access to a single table.
 * @typeparam DB Interface whose fields are table names defining tables.
 * @typeparam TB Name of the table.
 * @typeparam SelectedObject Type of objects returned by select queries.
 * @typeparam InsertedObject Type of objects inserted into the table.
 * @typeparam UpdaterObject Type of objects used to update rows of the table.
 * @typeparam ReturnedCount Type of count query results.
 * @typeparam ReturnColumns Columns to return from the table on insert or
 *  update, except when explicitly requesting no columns. `["*"]` returns
 *  all columns; `[]` returns none and is the default.
 * @typeparam ReturnedObject Objects to return from inserts and updates.
 */
export class TableMapper<
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
  UpdaterObject extends object = Partial<Insertable<DB[TB]>>,
  // TODO: support aliases in ReturnColumns and test
  ReturnColumns extends (keyof Selectable<DB[TB]> & string)[] | ['*'] = [],
  ReturnedCount = bigint,
  ReturnedObject extends object = ReturnColumns extends ['*']
    ? Selectable<DB[TB]>
    : ObjectWithKeys<Selectable<DB[TB]>, ReturnColumns>
> {
  /** Query builder on which this mapper is based. */
  protected readonly selectQB: SelectQueryBuilder<DB, TB, object>;

  /** Columns to return from selection queries. `[]` => all columns. */
  protected readonly selectedColumns: SelectionColumn<DB, TB>[];

  /** Columns to return from the table on insert or update. */
  protected returnColumns: (keyof Selectable<DB[TB]> & string)[] | ['*'];

  /** Converts retrieved rows to `SelectedObject`. */
  protected readonly rowConverter: RowConverter;

  /** Transforms query counts into `ReturnedCount`. */
  protected countTransform: (count: bigint) => ReturnedCount = (count) =>
    count as any;

  /**
   * Constructs a new table mapper.
   * @param db The Kysely database.
   * @param tableName The name of the table.
   * @param options Options governing mapper behavior. `returnColumns`
   *  defaults to returning no columns.
   */
  constructor(
    readonly db: Kysely<DB>,
    readonly tableName: TB,
    readonly options: TableMapperOptions<
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
    this.selectQB = db.selectFrom(tableName) as any;

    this.returnColumns = options.returnColumns ?? [];

    this.selectedColumns =
      options.selectedColumns === undefined
        ? ([] as any)
        : options.selectedColumns.includes('*' as any)
        ? ([] as any)
        : options.selectedColumns;
    this.rowConverter = new RowConverter(options.selectTransform);

    if (options.insertTransform) {
      this.transformInsertion = options.insertTransform;
    }
    if (options.updaterTransform) {
      this.transformUpdater = options.updaterTransform;
    }
    if (options.insertReturnTransform) {
      this.transformInsertReturn = options.insertReturnTransform;
    }
    if (options.countTransform) {
      this.countTransform = options.countTransform;
    }
  }

  /**
   * Deletes rows from the table.
   * @returns A mapper query for deleting rows.
   */
  delete(): DeletionQuery<DB, TB, DeleteQB<DB, TB>, ReturnedCount> {
    return new DeletionQuery(this.db, this.deleteQB(), this.countTransform);
  }

  /**
   * Creates a query builder for deleting rows from this table.
   * @returns A query builder for deleting rows from this table.
   */
  deleteQB() {
    return this.db.deleteFrom(this.tableName);
  }

  /**
   * Deletes from this table the rows that match the provided filter.
   * @param filter Filter specifying the rows to delete.
   * @returns Returns the number of deleted rows.
   */
  async deleteWhere<RE extends ReferenceExpression<DB, TB>>(
    filter: QueryFilter<DB, TB, RE, DeleteQB<DB, TB>>
  ): Promise<number> {
    const qb = applyQueryFilter(this.db, this.deleteQB(), filter);
    const result = await qb.executeTakeFirst();
    return Number(result.numDeletedRows);
  }

  /**
   * Creates a query builder for inserting rows into this table.
   * @returns A query builder for inserting rows into this table.
   */
  insertQB() {
    return this.db.insertInto(this.tableName);
  }

  /**
   * Inserts one or more rows into this table. For each row inserted,
   * retrieves the columns specified in the `returnColumns` option,
   * which are returned unless `insertReturnTransform` transforms them
   * into `ReturnedObject`. If `returnColumns` is empty, returns nothing.
   * @param objOrObjs The object or objects to insert as a row.
   * @returns Returns a `ReturnedObject` for each inserted object. Will
   *  be an array when `objOrObjs` is an array, will be a single object
   *  otherwise. Returns nothing (void) if `returnColumns` is empty.
   * @see this.insertNoReturns
   */
  insert(
    obj: InsertedObject
  ): Promise<ReturnColumns extends [] ? void : ReturnedObject>;

  insert(
    objs: InsertedObject[]
  ): Promise<ReturnColumns extends [] ? void : ReturnedObject[]>;

  async insert(
    objOrObjs: InsertedObject | InsertedObject[]
  ): Promise<ReturnedObject | ReturnedObject[] | void> {
    const insertedAnArray = Array.isArray(objOrObjs); // expensive operation
    let qb: InsertQueryBuilder<DB, TB, InsertResult>;
    if (insertedAnArray) {
      const transformedObjs = this.transformInsertionArray(objOrObjs);
      // TS requires separate calls to values() for different argument types.
      qb = this.insertQB().values(transformedObjs);
    } else {
      const transformedObj = this.transformInsertion(objOrObjs);
      // TS requires separate calls to values() for different argument types.
      qb = this.insertQB().values(transformedObj);
    }

    if (this.returnColumns.length == 0) {
      await qb.execute();
      return;
    }

    // Assign `returns` all at once to capture its complex type. Can't place
    // this in a shared method because the types are not compatible.
    const returns =
      this.returnColumns[0] == '*'
        ? await qb.returningAll().execute()
        : // prettier-ignore
          await qb.returning(
            this.returnColumns as (keyof Selectable<DB[TB]> & string)[]
          ).execute();
    if (returns === undefined) {
      throw Error('No rows returned from insert expecting returned columns');
    }
    if (insertedAnArray) {
      return this.transformInsertReturnArray(objOrObjs, returns as any);
    }
    return this.transformInsertReturn(objOrObjs, returns[0] as any);
  }

  /**
   * Inserts one or more rows into this table, without returning any columns.
   * @param objOrObjs The object or objects to insert as a row.
   * @see this.insert
   */
  insertNoReturns(obj: InsertedObject): Promise<void>;

  insertNoReturns(objs: InsertedObject[]): Promise<void>;

  async insertNoReturns(
    objOrObjs: InsertedObject | InsertedObject[]
  ): Promise<void> {
    const transformedObjOrObjs = this.transformInsertion(objOrObjs as any);
    const qb = this.insertQB().values(transformedObjOrObjs);
    await qb.execute();
  }

  /**
   * Returns a reference to a column, which can be a generated string.
   * @param column The column name being referenced.
   * @returns A reference to the given column.
   */
  ref(column: string) {
    return this.db.dynamic.ref(column);
  }

  /**
   * Creates a query builder for selecting rows from this table, returning
   * the columns and aliases specified in `SelectedColumns`.
   * @returns A query builder for selecting rows from this table.
   */
  selectedColumnsQB():
    | SelectQueryBuilder<DB, TB, object & AllSelection<DB, TB>>
    | (SelectedColumns extends ['*']
        ? never
        : SelectQueryBuilder<
            DB,
            TB,
            object & Selection<DB, TB, SelectedColumns[number]>
          >);

  selectedColumnsQB(): SelectQueryBuilder<DB, TB, any> {
    return this.selectedColumns.length == 0
      ? this.selectQB.selectAll()
      : this.selectQB.select(this.selectedColumns);
  }

  /**
   * Selects rows from the underlying query, retrieving all columns,
   * including the aliases of `SelectColumnAliases`, mapping each row
   * to type `SelectedObject`.
   * @param filter Optional filter to apply to the query. If not provided,
   *  you can still apply a filter to the returned query.
   * @returns A mapper query for retrieving entire rows as objects.
   */
  select<RE extends ReferenceExpression<DB, TB>>(
    filter?: QueryFilter<DB, TB, RE, SelectQueryBuilder<DB, TB, object>>
  ): SelectionQuery<
    DB,
    TB,
    SelectedObject,
    SelectQueryBuilder<DB, TB, object>
  > {
    return new SelectionQuery(
      this.db,
      filter === undefined
        ? (this.selectedColumnsQB() as any)
        : applyQueryFilter(this.db, this.selectedColumnsQB() as any, filter),
      this.rowConverter
    );
  }

  /**
   * Creates a query builder for updating rows in this table.
   * @returns A query builder for updating rows in this table.
   */
  updateQB() {
    return this.db.updateTable(this.tableName);
  }

  /**
   * Updates rows in this table matching the provided filter, returning
   * the number of updated rows.
   * @param filter Filter specifying the rows to update.
   * @param obj The object whose field values are to be assigned to the row.
   * @returns Returns the number of updated rows.
   * @see this.updateWhere
   */
  async updateCount<RE extends ReferenceExpression<DB, TB>>(
    filter: QueryFilter<DB, TB, RE, UpdateQB<DB, TB>>,
    obj: UpdaterObject
  ): Promise<number> {
    const transformedObj = this.transformUpdater(obj);
    const uqb = this.updateQB().set(transformedObj as any);
    const fqb = applyQueryFilter(this.db, uqb, filter);
    const result = await fqb.executeTakeFirst();
    return Number(result.numUpdatedRows);
  }

  /**
   * Updates rows in this table matching the provided filter. For each row
   * updated, retrieves the columns specified in the `returnColumns` option,
   * which are returned unless `updateReturnTransform` transforms them
   * into `ReturnedObject`. If `returnColumns` is empty, returns nothing.
   * @param filter Filter specifying the rows to update.
   * @param obj The object whose field values are to be assigned to the row.
   * @returns Returns an array of `ReturnedObject` objects, one for each
   *  updated row, or nothing (void) if `returnColumns` is empty.
   * @see this.updateCount
   */
  updateWhere<RE extends ReferenceExpression<DB, TB>>(
    filter: QueryFilter<DB, TB, RE, UpdateQB<DB, TB>>,
    obj: UpdaterObject
  ): Promise<ReturnColumns extends [] ? void : ReturnedObject[]>;

  async updateWhere<RE extends ReferenceExpression<DB, TB>>(
    filter: QueryFilter<DB, TB, RE, UpdateQB<DB, TB>>,
    obj: UpdaterObject
  ): Promise<ReturnedObject[] | void> {
    const transformedObj = this.transformUpdater(obj);
    const uqb = this.updateQB().set(transformedObj as any);
    const fqb = applyQueryFilter(this.db, uqb, filter);

    if (this.returnColumns.length == 0) {
      await fqb.execute();
      return;
    }

    // Assign `returns` all at once to capture its complex type. Can't place
    // this in a shared method because the types are not compatible.
    const returns =
      this.returnColumns[0] == '*'
        ? await fqb.returningAll().execute()
        : await fqb.returning(this.returnColumns as any).execute();
    if (returns === undefined) {
      throw Error('No rows returned from update expecting returned columns');
    }
    return this.transformUpdateReturn(obj, returns as any) as any;
  }

  /**
   * Transforms an object into a row for insertion.
   * @param obj The object to transform.
   * @returns Row representation of the object.
   */
  // This lengthy type provides better type assistance messages
  // in VSCode than a dedicated TransformInsertion type would.
  protected transformInsertion: NonNullable<
    TableMapperOptions<
      DB,
      TB,
      SelectedColumns,
      SelectedObject,
      InsertedObject,
      UpdaterObject,
      ReturnColumns,
      ReturnedCount,
      ReturnedObject
    >['insertTransform']
  > = (obj) => obj as Insertable<DB[TB]>;

  /**
   * Transforms an array of to-be-inserted objects into an insertable array
   * of rows. A utility for keeping transform code simple and performant.
   * @param source The array of inseted objects to transform.
   * @returns Array of rows representing the objects.
   */
  protected transformInsertionArray(
    source: InsertedObject[]
  ): Insertable<DB[TB]>[] {
    if (this.options.insertTransform) {
      // TS isn't seeing that that transform is defined.
      return source.map((obj) => this.options.insertTransform!(obj));
    }
    return source as any;
  }

  /**
   * Transforms an object returned from an insert into an object to be
   * returned to the caller.
   * @param source The object that was inserted.
   * @param returns The object returned from the insert.
   * @returns The object to be returned to the caller.
   */
  // This lengthy type provides better type assistance messages
  // in VSCode than a dedicated TransformInsertion type would.
  protected transformInsertReturn: NonNullable<
    TableMapperOptions<
      DB,
      TB,
      SelectedColumns,
      SelectedObject,
      InsertedObject,
      UpdaterObject,
      ReturnColumns,
      ReturnedCount,
      ReturnedObject
    >['insertReturnTransform']
  > = (_obj, ret) => ret as any;

  /**
   * Transforms an array of objects returned from an insert into an array
   * of objects to be returned to the caller.
   * @param source The array of objects that were inserted.
   * @param returns The array of objects returned from the insert.
   * @returns Array of objects to be returned to the caller.
   */
  protected transformInsertReturnArray(
    source: InsertedObject[],
    returns: ObjectWithKeys<Selectable<DB[TB]>, ReturnColumns>[]
  ): ReturnedObject[] {
    if (this.options.insertReturnTransform) {
      return source.map((obj, i) =>
        // TS isn't seeing that that transform is defined.
        this.options.insertReturnTransform!(obj, returns[i])
      );
    }
    return returns as any;
  }

  /**
   * Transforms an object into a row for insertion.
   * @param obj The object to transform.
   * @returns Row representation of the object.
   */
  // This lengthy type provides better type assistance messages
  // in VSCode than a dedicated TransformInsertion type would.
  protected transformUpdater: NonNullable<
    TableMapperOptions<
      DB,
      TB,
      SelectedColumns,
      SelectedObject,
      InsertedObject,
      UpdaterObject,
      ReturnColumns,
      ReturnedCount,
      ReturnedObject
    >['updaterTransform']
  > = (obj) => obj as Updateable<DB[TB]>;

  /**
   * Transforms an array of objects returned from an update
   * into objects to be returned to the caller.
   * @param source The object that provided the update values.
   * @param returns The array of objects returned from the update.
   * @returns Array of objects to be returned to the caller.
   */
  protected transformUpdateReturn(
    source: UpdaterObject,
    returns: ObjectWithKeys<Selectable<DB[TB]>, ReturnColumns>[]
  ): ReturnedObject[] {
    if (this.options.updateReturnTransform) {
      return returns.map((returnValues) =>
        // TS isn't seeing that that transform is defined.
        this.options.updateReturnTransform!(source, returnValues)
      );
    }
    return returns as any;
  }
}
