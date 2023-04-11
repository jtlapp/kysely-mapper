import { Compilable, Kysely } from 'kysely';
import { ParameterizedQuery, ParametersObject } from 'kysely-params';

/**
 * Class representing a parameterized query that returns a count. It can
 * be repeatedly executed or instantiated with different parameter values.
 * @paramtype P Record characterizing the parameter names and types.
 */
export class ParameterizedCountQuery<
  P extends ParametersObject<P>,
  ReturnedCount
> {
  #parameterizedQuery: ParameterizedQuery<P, any>;

  constructor(
    qb: Compilable<any>,
    protected readonly countTransform: (count: bigint) => ReturnedCount
  ) {
    this.#parameterizedQuery = new ParameterizedQuery(qb);
  }

  /**
   * Runs the query with all parameters replaced, returning the number
   * of rows affected, converted to the required client representation.
   * Compiles the query on the first call, caching the compiled query and
   * discarding the underlying query builder to reduce memory used.
   * @param db The Kysely database instance.
   * @param params Object providing values for all parameters.
   * @returns Number of rows affected, in client-requested representation.
   */
  async run<DB>(db: Kysely<DB>, params: P): Promise<ReturnedCount> {
    const result = await this.#parameterizedQuery.execute(db, params);
    return this.countTransform(result.numAffectedRows!);
  }
}
