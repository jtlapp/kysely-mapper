import { Kysely, UpdateQueryBuilder, UpdateResult } from 'kysely';

import { RowConverter } from '../lib/row-converter';

/**
 * Mapping query for updating rows from a database table.
 */
export class MappingUpdateQuery<
  DB,
  TB extends keyof DB & string,
  QB extends UpdateQueryBuilder<DB, TB, TB, UpdateResult>,
  ReturnedCount,
  ReturnedObject extends object
> {
  /**
   * @param db Kysely database instance.
   * @param qb Kysely update query builder.
   * @param rowConverter Converts objects of type `UpdaterObject` to rows.
   */
  constructor(
    readonly db: Kysely<DB>,
    readonly qb: QB,
    protected readonly countTransform: (count: bigint) => ReturnedCount,
    protected readonly rowConverter: RowConverter
  ) {}

  /**
   * Runs the query, returning the number of rows updated, in
   * the required client representation.
   * @returns Number of rows updated, in client-requested representation.
   */
  async getCount(): Promise<ReturnedCount> {
    const result = await this.qb.executeTakeFirst();
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
  async getReturns(): Promise<ReturnedObject[]> {
    const results = await this.qb.execute();
    return this.rowConverter.transformRows(results);
  }

  /**
   * Runs the query, updating rows, without returning any columns.
   */
  async run(): Promise<void> {
    await this.qb.execute();
  }

  /**
   * Modifies the underlying Kysely query builder.
   * @param factory A function that takes the current query builder and
   *  returns a new query builder.
   */
  modify<NextQB extends UpdateQueryBuilder<DB, TB, TB, UpdateResult>>(
    factory: (qb: QB) => NextQB
  ): MappingUpdateQuery<DB, TB, NextQB, ReturnedCount, ReturnedObject> {
    return new MappingUpdateQuery(
      this.db,
      factory(this.qb),
      this.countTransform,
      this.rowConverter
    );
  }
}
