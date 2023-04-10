import { Kysely, ReferenceExpression, SelectQueryBuilder } from 'kysely';
import { ParametersObject, QueryParameterMaker } from 'kysely-params';

import { applyQueryFilter, QueryFilter } from '../lib/query-filter';
import { RowConverter } from '../lib/row-converter';
import { ParameterizedRowQuery } from './paramed-row-query';

/**
 * Mapper query for selecting columns or entire rows from a Kysely query.
 */
export class SelectionQuery<
  DB,
  TB extends keyof DB & string,
  SelectedObject extends object,
  QB extends SelectQueryBuilder<DB, TB, any>
> {
  /**
   * @param db Kysely database instance.
   * @param tableName Name of the table this mapper is for.
   * @param options Options governing builder behavior.
   */
  constructor(
    readonly db: Kysely<DB>,
    readonly qb: QB,
    protected readonly rowConverter: RowConverter
  ) {}

  /**
   * Constrains the query results according to the provided filter.
   * @param filter The filter to apply.
   * @returns A new mapper query with the filter applied.
   */
  filter<RE extends ReferenceExpression<DB, TB>>(
    filter: QueryFilter<DB, TB, RE, SelectQueryBuilder<DB, TB, object>, QB>
  ): SelectionQuery<DB, TB, SelectedObject, QB> {
    return new SelectionQuery(
      this.db,
      applyQueryFilter(this.db, this.qb, filter),
      this.rowConverter
    );
  }

  /**
   * Retrieves zero or more rows from the underlying query, mapping the rows
   * to objects of type `SelectedObject`.
   * @returns An array of objects for the selected rows, possibly empty.
   */
  async getMany(): Promise<SelectedObject[]> {
    const results = await this.qb.execute();
    return this.rowConverter.transformRows(results);
  }

  /**
   * Retrieves a single rows from the underlying query, mapping the row
   * to an object of type `SelectedObject`.
   * @returns An object for the selected rows, or null if not found.
   */
  async getOne(): Promise<SelectedObject | null> {
    const result = await this.qb.executeTakeFirst();
    if (!result) return null;
    return this.rowConverter.transformRow(result);
  }

  /**
   * Modifies the underlying Kysely query builder. TODO: When subselecting,
   * columns can be added to the selection but not removed. When not
   * subselecting, all columns are already selected and selecting more
   * has no effect, except for providing additional aliases.
   * @param factory A function that takes the current query builder and
   *  returns a new query builder.
   */
  modify<NextQB extends SelectQueryBuilder<DB, TB, any>>(
    factory: (qb: QB) => NextQB
  ): SelectionQuery<DB, TB, SelectedObject, NextQB> {
    return new SelectionQuery(this.db, factory(this.qb), this.rowConverter);
  }

  /**
   * Creates and returns a parameterized mapper query, which can be repeatedly
   * executed with different parameter values, but which only ever compiles
   * the underlying Kysely query once (on the first execution).
   * @paramtype P Record characterizing the available parameter names and types.
   * @param factory Function that receives an object of the form `{ q, param }`,
   *  where `q` is a mapper query and `param` is a function for creating
   *  parameters. The argument to `param` is the name of the parameter, which
   *  must occur as a property of `P`. You may parameterize inserted values,
   *  updated values, and right-hand-side values of filters. Parameters may not
   *  be arrays, but you can parameterize the individual elements of an array.
   *  Returns a mapper query that containing the parameterized values.
   * @returns a parameterized mapper query
   */
  parameterize<P extends ParametersObject<P>>(
    factory: ParamedSelectionQueryFactory<
      P,
      SelectionQuery<DB, TB, SelectedObject, QB>
    >
  ): ParameterizedRowQuery<P, SelectedObject> {
    const parameterMaker = new QueryParameterMaker<P>();
    return new ParameterizedRowQuery(
      factory({
        q: this,
        param: parameterMaker.param.bind(parameterMaker),
      }).qb,
      this.rowConverter
    );
  }
}

/**
 * Factory function for parameterizing SelectionQuery.
 */
interface ParamedSelectionQueryFactory<
  P extends ParametersObject<P>,
  Q extends SelectionQuery<any, any, any, any>
> {
  (args: { q: Q; param: QueryParameterMaker<P>['param'] }): Q;
}
