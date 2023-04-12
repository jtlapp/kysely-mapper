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
  UpdaterObject extends object,
  ReturnColumns extends (keyof Selectable<DB[TB]> & string)[] | ['*'],
  ReturnedCount,
  ReturnedObject extends object
> {
  protected readonly returnColumns: ReturnColumns;
  #returningQB: UpdateQueryBuilder<DB, TB, TB, any> | null = null;

  /**
   * @param db Kysely database instance.
   * @param qb Kysely update query builder.
   * @param countTransform A function that transforms the number of updated
   *  rows into the representation required by the client.
   * @param updaterTransform A function that transforms the updating object
   *  into a row for updating the database.
   * @param returnColumns The columns to return from the update query.
   *  If `returnColumns` is `['*']`, returns all columns. If `returnColumns`
   *  is empty, returns nothing.
   * @param updateReturnTransform A function that transforms the returned
   *  row into the object to be returned from the update query.
   */
  constructor(
    readonly db: Kysely<DB>,
    readonly qb: QB,
    protected readonly countTransform: (count: bigint) => ReturnedCount,
    protected readonly updaterTransform?: (
      update: UpdaterObject
    ) => Updateable<DB[TB]>,
    returnColumns?: ReturnColumns,
    protected readonly updateReturnTransform?: (
      source: UpdaterObject,
      returns: ObjectWithKeys<Selectable<DB[TB]>, ReturnColumns>
    ) => ReturnedObject
  ) {
    this.returnColumns = returnColumns ?? ([] as any);
  }

  /**
   * Runs the query, returning the number of rows updated, in
   * the required client representation.
   * @param obj The object which which to update the rows.
   * @returns Number of rows updated, in client-requested representation.
   */
  async getCount(obj: UpdaterObject): Promise<ReturnedCount> {
    const result = await this.loadUpdaterObject(
      this.qb,
      obj
    ).executeTakeFirst();
    return this.countTransform(result.numUpdatedRows);
  }

  /**
   * Runs the query, updating rows. For each row updated, retrieves the
   * columns specified in the `returnColumns` option, which are returned
   * unless `updateReturnTransform` transforms them into `ReturnedObject`.
   * If `returnColumns` is empty, returns nothing.
   * @returns Returns an array of `ReturnedObject` objects, one for each
   *  updated row.
   */
  getReturns(
    obj: UpdaterObject
  ): Promise<ReturnColumns extends [] ? void : ReturnedObject[]>;

  async getReturns(obj: UpdaterObject): Promise<ReturnedObject[] | void> {
    if (this.returnColumns.length === 0) {
      await this.loadUpdaterObject(this.qb, obj).execute();
    } else {
      const returns = await this.loadUpdaterObject(
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
  }

  /**
   * Runs the query, updating rows, without returning any columns.
   * @param obj The object which which to update the rows.
   * @returns `true` if any rows were updated, `false` otherwise.
   */
  async run(obj: UpdaterObject): Promise<boolean> {
    const results = await this.loadUpdaterObject(
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
    UpdaterObject,
    ReturnColumns,
    ReturnedCount,
    ReturnedObject
  > {
    return new MappingUpdateQuery(
      this.db,
      factory(this.qb),
      this.countTransform,
      this.updaterTransform,
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
  protected loadUpdaterObject(
    qb: UpdateQueryBuilder<DB, TB, TB, UpdateResult>,
    obj: UpdaterObject
  ): UpdateQueryBuilder<DB, TB, TB, UpdateResult> {
    const transformedObj =
      this.updaterTransform === undefined ? obj : this.updaterTransform(obj);
    return qb.set(transformedObj);
  }
}
