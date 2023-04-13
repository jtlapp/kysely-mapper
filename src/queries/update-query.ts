import {
  Kysely,
  Selectable,
  UpdateQueryBuilder,
  UpdateResult,
  Updateable,
} from 'kysely';
import { ObjectWithKeys } from '../lib/type-utils';

// TODO: look into factoring out methods into base classes

/**
 * Mapping query for updating rows from a database table.
 */
export class MappingUpdateQuery<
  DB,
  TB extends keyof DB & string,
  QB extends UpdateQueryBuilder<DB, TB, TB, UpdateResult>,
  UpdatingObject extends object,
  SelectedObject extends object,
  ReturnColumns extends (keyof Selectable<DB[TB]> & string)[] | ['*'],
  ReturnCount,
  UpdateReturnsSelectedObjectWhenProvided extends boolean,
  DefaultReturnObject extends object
> {
  protected readonly returnColumns: ReturnColumns;
  #returningQB: UpdateQueryBuilder<DB, TB, TB, any> | null = null;

  /**
   * @param db Kysely database instance.
   * @param qb Kysely update query builder.
   * @param countTransform A function that transforms the number of updated
   *  rows into the representation required by the client.
   * @param updateTransform A function that transforms the updating object
   *  into a row for updating the database.
   * @param returnColumns The columns to return from the update query.
   *  If `returnColumns` is `['*']`, returns all columns. If `returnColumns`
   *  is empty, returns nothing.
   * @param updateReturnTransform A function that transforms the returned
   *  row into the object to be returned from the update query. When
   * `UpdateReturnsSelectedObjectWhenProvided` is `true`, the returned
   *  object is of type `SelectedObject` if the function's input is also
   *  of this type; otherwise it is of type `DefaultReturnObject`.
   */
  constructor(
    readonly db: Kysely<DB>,
    readonly qb: QB,
    protected readonly countTransform: (count: bigint) => ReturnCount,
    protected readonly updateTransform?: (
      update: UpdatingObject
    ) => Updateable<DB[TB]>,
    returnColumns?: ReturnColumns,
    protected readonly updateReturnTransform?: (
      source: UpdatingObject,
      returns: ObjectWithKeys<Selectable<DB[TB]>, ReturnColumns>
    ) => UpdateReturnsSelectedObjectWhenProvided extends true
      ? UpdatingObject extends SelectedObject
        ? SelectedObject
        : DefaultReturnObject
      : DefaultReturnObject
  ) {
    this.returnColumns = returnColumns ?? ([] as any);
  }

  /**
   * Runs the query, returning the number of rows updated, in
   * the required client representation.
   * @param obj The object which which to update the rows.
   * @returns Number of rows updated, in client-requested representation.
   */
  async getCount(obj: UpdatingObject): Promise<ReturnCount> {
    const result = await this.loadUpdatingObject(
      this.qb,
      obj
    ).executeTakeFirst();
    return this.countTransform(result.numUpdatedRows);
  }

  /**
   * Updates rows with the values that result from transforming the object via
   * `insertTransform` (if defined). For each row updated, retrieves the
   * columns specified in `returnColumns` (if defined), returning them to the
   * caller as either `DefaultReturnObject` or `SelectedObject`, depending
   * on whether `UpdateReturnsSelectedObjectWhenProvided` is `true` and the
   * provided object is a `SelectedObject`, after transformation by
   * `updateReturnTransform`. If `returnColumns` is empty, returns `undefined`.
   * @returns If `returnColumns` is not empty, returns an array containing one
   *  object for each row updated; otherwise returns `undefined`.
   */
  getAll(
    obj: UpdatingObject
  ): Promise<
    ReturnColumns extends []
      ? void
      : UpdateReturnsSelectedObjectWhenProvided extends true
      ? UpdatingObject extends SelectedObject
        ? SelectedObject[]
        : DefaultReturnObject[]
      : DefaultReturnObject[]
  >;

  async getAll(
    obj: UpdatingObject
  ): Promise<
    | (UpdateReturnsSelectedObjectWhenProvided extends true
        ? UpdatingObject extends SelectedObject
          ? SelectedObject[]
          : DefaultReturnObject[]
        : DefaultReturnObject[])
    | void
  > {
    if (this.returnColumns.length === 0) {
      await this.loadUpdatingObject(this.qb, obj).execute();
      return;
    }
    const returns = await this.loadUpdatingObject(
      this.getReturningQB(),
      obj
    ).execute();
    if (returns === undefined) {
      throw Error('No rows returned from update expecting returned columns');
    }
    return this.updateReturnTransform === undefined
      ? (returns as any)
      : returns.map((row) => this.updateReturnTransform!(obj, row as any));
  }

  /**
   * Updates rows with the values that result from transforming the object via
   * `insertTransform` (if defined). For the first row updated, retrieves the
   * columns specified in `returnColumns` (if defined), returning them to the
   * caller as either `DefaultReturnObject` or `SelectedObject`, depending
   * on whether `UpdateReturnsSelectedObjectWhenProvided` is `true` and the
   * provided object is a `SelectedObject`, after transformation by
   * `updateReturnTransform`. If `returnColumns` is empty, returns `undefined`.
   * @returns If `returnColumns` is empty, returns `undefined`. Otherwise,
   *  returns the first object if at least one row was updated, or `null` if
   * no rows were updated.
   */
  getOne(
    obj: UpdatingObject
  ): Promise<
    ReturnColumns extends []
      ? void
      :
          | (UpdateReturnsSelectedObjectWhenProvided extends true
              ? UpdatingObject extends SelectedObject
                ? SelectedObject
                : DefaultReturnObject
              : DefaultReturnObject)
          | null
  >;

  async getOne(
    obj: UpdatingObject
  ): Promise<
    | (UpdateReturnsSelectedObjectWhenProvided extends true
        ? UpdatingObject extends SelectedObject
          ? SelectedObject
          : DefaultReturnObject
        : DefaultReturnObject)
    | null
    | void
  > {
    if (this.returnColumns.length === 0) {
      await this.loadUpdatingObject(this.qb, obj).execute();
      return;
    }
    const returns = await this.loadUpdatingObject(
      this.getReturningQB(),
      obj
    ).execute();
    if (returns === undefined) {
      throw Error('No rows returned from update expecting returned columns');
    }
    if (returns.length === 0) {
      return null;
    }
    return this.updateReturnTransform === undefined
      ? (returns[0] as any)
      : this.updateReturnTransform!(obj, returns[0] as any);
  }

  /**
   * Runs the query, updating rows, without returning any columns.
   * @param obj The object which which to update the rows.
   * @returns `true` if any rows were updated, `false` otherwise.
   */
  async run(obj: UpdatingObject): Promise<boolean> {
    const results = await this.loadUpdatingObject(
      this.qb,
      obj
    ).executeTakeFirst();
    return results.numUpdatedRows !== BigInt(0);
  }

  /**
   * Modifies the underlying Kysely query builder.
   * @param factory A function that takes the current query builder and
   *  returns a new query builder.
   */
  modify<NextQB extends UpdateQueryBuilder<DB, TB, TB, any>>(
    factory: (qb: QB) => NextQB
  ): MappingUpdateQuery<
    DB,
    TB,
    NextQB,
    UpdatingObject,
    SelectedObject,
    ReturnColumns,
    ReturnCount,
    UpdateReturnsSelectedObjectWhenProvided,
    DefaultReturnObject
  > {
    return new MappingUpdateQuery(
      this.db,
      factory(this.qb),
      this.countTransform,
      this.updateTransform,
      this.returnColumns,
      this.updateReturnTransform
    );
  }

  /**
   * Returns a query builder for updating rows in the table and
   * returning values, caching the query builder for future use.
   * @returns A query builder for updating rows in the table and
   *  returning values.
   */
  protected getReturningQB(): UpdateQueryBuilder<DB, TB, TB, any> {
    if (this.#returningQB === null) {
      this.#returningQB =
        this.returnColumns[0] == '*'
          ? this.qb.returningAll()
          : this.qb.returning(
              this.returnColumns as (keyof Selectable<DB[TB]> & string)[]
            );
    }
    return this.#returningQB;
  }

  /**
   * Loads the object with which to update rows.
   * @param qb The query builder to load the objects into.
   * @param obj The object with which to update rows.
   * @returns The query builder with the object loaded.
   */
  protected loadUpdatingObject(
    qb: UpdateQueryBuilder<DB, TB, TB, UpdateResult>,
    obj: UpdatingObject
  ): UpdateQueryBuilder<DB, TB, TB, UpdateResult> {
    const transformedObj =
      this.updateTransform === undefined ? obj : this.updateTransform(obj);
    return qb.set(transformedObj);
  }
}
