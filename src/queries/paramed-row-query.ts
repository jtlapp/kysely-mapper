import { Compilable, Kysely } from 'kysely';
import { ParameterizedQuery, ParametersObject } from 'kysely-params';

/**
 * Class representing a parameterized query that returns rows. It can be
 * repeatedly executed or instantiated with different parameter values.
 * @paramtype P Record characterizing the parameter names and types.
 */
export class ParameterizedRowQuery<
  P extends ParametersObject<P>,
  SelectedObject extends object
> {
  #parameterizedQuery: ParameterizedQuery<P, any>;

  constructor(qb: Compilable<any>, protected readonly converter: any) {
    this.#parameterizedQuery = new ParameterizedQuery(qb);
  }

  /**
   * Executes the query with all parameters replaced, returning all results.
   * Compiles the query on the first call, caching the compiled query and
   * discarding the underlying query builder to reduce memory used.
   * @param db The Kysely database instance.
   * @param params Object providing values for all parameters.
   * @returns Query result.
   */
  async getMany<DB>(db: Kysely<DB>, params: P): Promise<SelectedObject[]> {
    const results = await this.#parameterizedQuery.execute(db, params);
    return this.converter.transformRows(results.rows);
  }

  /**
   * Executes the query with all parameters replaced, returning the first
   * result. Compiles the query on the first call, caching the compiled query
   * and discarding the underlying query builder to reduce memory used.
   * @param db The Kysely database instance.
   * @param params Object providing values for all parameters.
   * @returns First query result, or undefined if there are no results.
   */
  async getOne<DB>(db: Kysely<DB>, params: P): Promise<SelectedObject | null> {
    const result = await this.#parameterizedQuery.executeTakeFirst(db, params);
    if (!result) return null;
    return this.converter.transformRow(result);
  }
}
