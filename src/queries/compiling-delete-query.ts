import { DeleteQueryBuilder, Kysely, QueryResult } from 'kysely';
import { CompilableMappingQuery } from './compilable-query';
import { ParameterizedQuery, ParametersObject } from 'kysely-params';

/**
 * Compiling mapping query for deleting rows from a database table.
 */
export class CompilingMappingDeleteQuery<
  DB,
  TB extends keyof DB & string,
  QB extends DeleteQueryBuilder<DB, TB, any>,
  ReturnCount,
  P extends ParametersObject<P>
> implements CompilableMappingQuery
{
  #parameterizedQuery: ParameterizedQuery<P, QueryResult<any>>;

  /**
   * @param db Kysely database instance.
   * @param qb Kysely delete query builder.
   * @param countTransform Function that transforms returned row counts
   */
  constructor(
    protected readonly db: Kysely<DB>,
    protected readonly qb: QB,
    protected readonly countTransform: (count: bigint) => ReturnCount
  ) {
    this.#parameterizedQuery = new ParameterizedQuery(qb);
  }

  /**
   * Runs the query, returning the number of rows deleted, converted to
   * the required client representation. On the first execution, compiles
   * and discards the underlying Kysely query builder to reduce memory
   * usage. Subsequent executions reuse the compiled query. Accepts values
   * for any parameters embedded in the query.
   * @param params Record characterizing the parameter names and types.
   *  Pass in `{}` if the query has no parameters.
   * @returns Number of rows deleted, in client-requested representation.
   */
  async getCount(params: P): Promise<ReturnCount> {
    const result = await this.#parameterizedQuery.execute(this.db, params);
    return this.countTransform(result.numAffectedRows!);
  }

  /**
   * Runs the query, deleting the indicated rows, returning nothing.  On
   * the first execution, compiles and discards the underlying Kysely query
   * builder to reduce memory usage. Subsequent executions reuse the compiled
   * query. Accepts values for any parameters embedded in the query.
   * @param params Record characterizing the parameter names and types.
   *  Pass in `{}` if the query has no parameters.
   * @returns `true` if any rows were deleted, `false` otherwise.
   */
  async run(params: P): Promise<boolean> {
    const results = await this.#parameterizedQuery.execute(this.db, params);
    return results.numAffectedRows !== BigInt(0);
  }
}
