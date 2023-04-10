import {
  DeleteQueryBuilder,
  DeleteResult,
  Kysely,
  ReferenceExpression,
} from "kysely";
import { ParametersObject, QueryParameterMaker } from "kysely-params";

import { applyQueryFilter, QueryFilter } from "../../lib/query-filter";
import { ParameterizedCountQuery } from "../../lib/paramed-count-query";

/**
 * Lens query for deleting rows from a database table.
 */
export class DeletionQuery<
  DB,
  TB extends keyof DB & string,
  QB extends DeleteQueryBuilder<DB, any, DeleteResult>,
  ReturnedCount
> {
  /**
   * @param db Kysely database instance.
   * @param tableName Name of the table this lens is for.
   * @param options Options governing builder behavior.
   */
  constructor(
    readonly db: Kysely<DB>,
    readonly qb: QB,
    protected readonly countTransform: (count: bigint) => ReturnedCount
  ) {}

  /**
   * Constrains the query results according to the provided filter.
   * @param filter The filter to apply.
   * @returns A new lens query with the filter applied.
   */
  filter<RE extends ReferenceExpression<DB, TB>>(
    filter: QueryFilter<DB, TB, RE, QB>
  ): DeletionQuery<DB, TB, QB, ReturnedCount> {
    return new DeletionQuery(
      this.db,
      applyQueryFilter(this.db, this.qb, filter),
      this.countTransform
    );
  }

  /**
   * Modifies the underlying Kysely query builder.
   * @param factory A function that takes the current query builder and
   *  returns a new query builder.
   */
  modify<NextQB extends DeleteQueryBuilder<DB, any, DeleteResult>>(
    factory: (qb: QB) => NextQB
  ): DeletionQuery<DB, TB, NextQB, ReturnedCount> {
    return new DeletionQuery(this.db, factory(this.qb), this.countTransform);
  }

  /**
   * Creates and returns a parameterized lens query, which can be repeatedly
   * executed with different parameter values, but which only ever compiles
   * the underlying Kysely query once (on the first execution).
   * @paramtype P Record characterizing the available parameter names and types.
   * @param factory Function that receives an object of the form `{ q, param }`,
   *  where `q` is a lense query and `param` is a function for creating
   *  parameters. The argument to `param` is the name of the parameter, which
   *  must occur as a property of `P`. You may parameterize inserted values,
   *  updated values, and right-hand-side values of filters. Parameters may not
   *  be arrays, but you can parameterize the individual elements of an array.
   *  Returns a lens query that containing the parameterized values.
   * @returns a parameterized lens query
   */
  parameterize<P extends ParametersObject<P>>(
    factory: ParamedDeletionQueryFactory<
      P,
      DeletionQuery<DB, TB, QB, ReturnedCount>
    >
  ): ParameterizedCountQuery<P, ReturnedCount> {
    const parameterMaker = new QueryParameterMaker<P>();
    return new ParameterizedCountQuery(
      factory({
        q: this,
        param: parameterMaker.param.bind(parameterMaker),
      }).qb,
      this.countTransform
    );
  }

  /**
   * Runs the query, returning the number of rows deleted, converted
   * to the required client representation.
   * @returns Number of rows deleted, in client-requested representation.
   */
  async run(): Promise<ReturnedCount> {
    const results = await this.qb.executeTakeFirst();
    return this.countTransform(results.numDeletedRows);
  }
}

/**
 * Factory function for parameterizing DeletionQuery.
 */
interface ParamedDeletionQueryFactory<
  P extends ParametersObject<P>,
  Q extends DeletionQuery<any, any, any, any>
> {
  (args: { q: Q; param: QueryParameterMaker<P>["param"] }): Q;
}
