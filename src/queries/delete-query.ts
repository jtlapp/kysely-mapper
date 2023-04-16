import { DeleteQueryBuilder, DeleteResult, Kysely } from 'kysely';
import { CompilableMappingQuery } from './compilable-query';

/**
 * Mapping query for deleting rows from a database table.
 */
export class MappingDeleteQuery<
  DB,
  TB extends keyof DB & string,
  QB extends DeleteQueryBuilder<DB, TB, DeleteResult>,
  ReturnCount
> implements CompilableMappingQuery
{
  /**
   * @param db Kysely database instance.
   * @param qb Kysely delete query builder.
   * @param countTransform Function that transforms returned row counts
   */
  constructor(
    protected readonly db: Kysely<DB>,
    protected readonly qb: QB,
    protected readonly countTransform: (count: bigint) => ReturnCount
  ) {}

  /**
   * Runs the query, returning the number of rows deleted, converted to
   * the required client representation.
   * @returns Number of rows deleted, in client-requested representation.
   */
  async getCount(): Promise<ReturnCount> {
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
  ): MappingDeleteQuery<DB, TB, NextQB, ReturnCount> {
    return new MappingDeleteQuery(
      this.db,
      factory(this.qb),
      this.countTransform
    );
  }

  /**
   * Runs the query, deleting the indicated rows, returning nothing.
   * @returns `true` if any rows were deleted, `false` otherwise.
   */
  async run(): Promise<boolean> {
    const results = await this.qb.executeTakeFirst();
    return results.numDeletedRows !== BigInt(0);
  }
}
