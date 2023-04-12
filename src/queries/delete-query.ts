import { DeleteQueryBuilder, DeleteResult, Kysely } from 'kysely';

/**
 * Mapping query for deleting rows from a database table.
 */
export class MappingDeleteQuery<
  DB,
  TB extends keyof DB & string,
  QB extends DeleteQueryBuilder<DB, TB, DeleteResult>,
  ReturnedCount
> {
  /**
   * @param db Kysely database instance.
   * @param qb Kysely delete query builder.
   * @param countTransform Function that transforms returned row counts
   */
  constructor(
    protected readonly db: Kysely<DB>,
    protected readonly qb: QB,
    protected readonly countTransform: (count: bigint) => ReturnedCount
  ) {}

  /**
   * Runs the query, returning the number of rows deleted, converted to
   * the required client representation.
   * @returns Number of rows deleted, in client-requested representation.
   */
  async getCount(): Promise<ReturnedCount> {
    const result = await this.qb.executeTakeFirst();
    return this.countTransform(result.numDeletedRows);
  }

  /**
   * Modifies the underlying Kysely query builder.
   * @param factory A function that takes the current query builder and
   *  returns a new query builder.
   */
  modify<NextQB extends DeleteQueryBuilder<DB, any, DeleteResult>>(
    factory: (qb: QB) => NextQB
  ): MappingDeleteQuery<DB, TB, NextQB, ReturnedCount> {
    return new MappingDeleteQuery(
      this.db,
      factory(this.qb),
      this.countTransform
    );
  }

  /**
   * Runs the query, returning nothing.
   */
  async run(): Promise<void> {
    await this.qb.execute();
  }
}
