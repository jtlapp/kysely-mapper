import { Kysely, SelectQueryBuilder } from 'kysely';
import { SelectedRow, SelectionColumn } from '../lib/type-utils';
import { ParameterizableMappingSelectQuery } from './compilable-query';
import { ParameterizedQuery, ParametersObject } from 'kysely-params';

/**
 * Compiling mapping query for selecting rows from a database table.
 */
export class CompilingMappingSelectQuery<
  DB,
  TB extends keyof DB & string,
  SelectedColumns extends SelectionColumn<DB, TB>[] | ['*'],
  SelectedObject extends object,
  QB extends SelectQueryBuilder<DB, TB, any>,
  P extends ParametersObject<P>
> implements ParameterizableMappingSelectQuery
{
  #parameterizedQuery: ParameterizedQuery<P, SelectedObject>;

  /**
   * @param db Kysely database instance.
   * @param qb Kysely select query builder.
   * @param selectTransform A function that transforms a selected row
   *  into an object to be returned from the select query.
   */
  constructor(
    readonly db: Kysely<DB>,
    qb: QB,
    protected readonly selectTransform?: (
      row: SelectedRow<
        DB,
        TB,
        SelectedColumns extends ['*'] ? never : SelectedColumns[number],
        SelectedColumns
      >
    ) => SelectedObject
  ) {
    this.#parameterizedQuery = new ParameterizedQuery(qb);
  }

  /**
   * Retrieves zero or more rows from the table, using `selectTransform`
   * (if provided) to map the rows to objects of type `SelectedObject`. On
   * the first execution, compiles and discards the underlying Kysely query
   * builder to reduce memory usage. Subsequent executions reuse the compiled
   * query. Accepts values for any parameters embedded in the query.
   * @param params Record characterizing the parameter names and types.
   *  Pass in `{}` if the query has no parameters.
   * @returns An array of objects for the selected rows, possibly empty.
   */
  async returnAll(params: P): Promise<SelectedObject[]> {
    const results = await this.#parameterizedQuery.execute(this.db, params);
    return this.selectTransform === undefined
      ? (results.rows as SelectedObject[])
      : (results.rows as any[]).map(this.selectTransform);
  }

  /**
   * Retrieves a single row from the table, using `selectTransform` (if
   * provided) to map the row to an object of type `SelectedObject`. On the
   * first execution, compiles and discards the underlying Kysely query
   * builder to reduce memory usage. Subsequent executions reuse the compiled
   * query. Accepts values for any parameters embedded in the query.
   * @param params Record characterizing the parameter names and types.
   *  Pass in `{}` if the query has no parameters.
   * @returns An object for the selected rows, or null if not found.
   */
  async returnOne(params: P): Promise<SelectedObject | null> {
    const result = await this.#parameterizedQuery.executeTakeFirst(
      this.db,
      params
    );
    if (!result) return null;
    return result === undefined
      ? null
      : this.selectTransform === undefined
      ? (result as SelectedObject)
      : this.selectTransform(result as any);
  }
}
