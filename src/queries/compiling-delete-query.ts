import { DeleteQueryBuilder, Kysely, QueryResult } from 'kysely';
import { ParameterizedQuery, ParametersObject } from 'kysely-params';

import { CountTransform } from '../mappers/table-mapper-transforms';
import { ParameterizableMappingQuery } from './parameterizable-query';

/**
 * Compiling mapping query for deleting rows from a database table.
 */
export class CompilingMappingDeleteQuery<
  DB,
  TB extends keyof DB & string,
  QB extends DeleteQueryBuilder<DB, TB, any>,
  ReturnCount,
  Parameters extends ParametersObject<Parameters>
> implements ParameterizableMappingQuery
{
  #parameterizedQuery: ParameterizedQuery<Parameters, QueryResult<any>>;

  constructor(
    protected readonly db: Kysely<DB>,
    protected readonly qb: QB,
    protected readonly transforms: Readonly<CountTransform<ReturnCount>>
  ) {
    this.#parameterizedQuery = new ParameterizedQuery(qb);
  }

  /**
   * Runs the query, returning the number of rows deleted, converted to
   * the required client representation. Accepts values for any parameters
   * embedded in the query.
   *
   * On the first execution, compiles and discards the underlying Kysely
   * query builder. Subsequent executions reuse the compiled query.
   * @param params Record characterizing the parameter names and types.
   *  Pass in `{}` if the query has no parameters.
   * @returns Number of rows deleted, in client-requested representation.
   */
  async returnCount(params: Parameters): Promise<ReturnCount> {
    const result = await this.#parameterizedQuery.execute(this.db, params);
    return this.transforms.countTransform === undefined
      ? (result.numAffectedRows! as ReturnCount)
      : this.transforms.countTransform(result.numAffectedRows!);
  }

  /**
   * Runs the query, deleting the indicated rows, returning nothing.
   * Accepts values for any parameters embedded in the query.
   *
   * On the first execution, compiles and discards the underlying Kysely
   * query builder. Subsequent executions reuse the compiled query.
   * @param params Record characterizing the parameter names and types.
   *  Pass in `{}` if the query has no parameters.
   * @returns `true` if any rows were deleted, `false` otherwise.
   */
  async run(params: Parameters): Promise<boolean> {
    const results = await this.#parameterizedQuery.execute(this.db, params);
    return results.numAffectedRows !== BigInt(0);
  }
}
