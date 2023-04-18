import { Kysely, SelectQueryBuilder } from 'kysely';
import { AllColumns, SelectionColumn } from '../lib/type-utils';
import { ParameterizableMappingQuery } from './paramable-query';
import { ParameterizedQuery, ParametersObject } from 'kysely-params';
import { SelectTransform } from '../mappers/table-mapper-transforms';

/**
 * Compiling mapping query for selecting rows from a database table.
 */
export class CompilingMappingSelectQuery<
  DB,
  TB extends keyof DB & string,
  SelectedColumns extends Readonly<SelectionColumn<DB, TB>[]> | AllColumns,
  SelectedObject extends object,
  QB extends SelectQueryBuilder<DB, TB, any>,
  P extends ParametersObject<P>
> implements ParameterizableMappingQuery
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
  async returnAll(params: P): Promise<SelectedObject[]> {
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
  async returnOne(params: P): Promise<SelectedObject | null> {
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
