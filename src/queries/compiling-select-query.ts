import { Kysely, SelectQueryBuilder } from 'kysely';
import { ParameterizedQuery, ParametersObject } from 'kysely-params';

import { SelectionColumn } from '../lib/type-utils.js';
import { ParameterizableMappingQuery } from './parameterizable-query.js';
import { SelectTransform } from '../mappers/table-mapper-transforms.js';

/**
 * Compiling mapping query for selecting rows from a database table.
 */
export class CompilingMappingSelectQuery<
  DB,
  TB extends keyof DB & string,
  SelectedColumns extends Readonly<SelectionColumn<DB, TB>[]> | ['*'],
  SelectedObject,
  QB extends SelectQueryBuilder<DB, TB, any>,
  Parameters extends ParametersObject<Parameters>
> implements ParameterizableMappingQuery
{
  #parameterizedQuery: ParameterizedQuery<Parameters, SelectedObject>;

  constructor(
    readonly db: Kysely<DB>,
    qb: QB,
    protected readonly transforms: Readonly<
      SelectTransform<DB, TB, SelectedColumns, SelectedObject>
    >
  ) {
    this.#parameterizedQuery = new ParameterizedQuery(qb);
  }

  /**
   * Retrieves zero or more rows from the table, using `selectTransform`
   * (if provided) to map the rows to objects of type `SelectedObject`.
   * Accepts values for any parameters embedded in the query.
   *
   * On the first execution, compiles and discards the underlying Kysely
   * query builder. Subsequent executions reuse the compiled query.
   * @param params Record characterizing the parameter names and types.
   *  Pass in `{}` if the query has no parameters.
   * @returns An array of objects for the selected rows, possibly empty.
   */
  async returnAll(params: Parameters): Promise<SelectedObject[]> {
    const results = await this.#parameterizedQuery.execute(this.db, params);
    return this.transforms.selectTransform === undefined
      ? (results.rows as SelectedObject[])
      : (results.rows as any[]).map(this.transforms.selectTransform);
  }

  /**
   * Retrieves a single row from the table, using `selectTransform` (if
   * provided) to map the row to an object of type `SelectedObject`.
   * Accepts values for any parameters embedded in the query.
   *
   * On the first execution, compiles and discards the underlying Kysely
   * query builder. Subsequent executions reuse the compiled query.
   * @param params Record characterizing the parameter names and types.
   *  Pass in `{}` if the query has no parameters.
   * @returns An object for the selected rows, or null if not found.
   */
  async returnOne(params: Parameters): Promise<SelectedObject | null> {
    const result = await this.#parameterizedQuery.executeTakeFirst(
      this.db,
      params
    );
    if (!result) return null;
    return result === undefined
      ? null
      : this.transforms.selectTransform === undefined
      ? (result as SelectedObject)
      : this.transforms.selectTransform(result as any);
  }
}
