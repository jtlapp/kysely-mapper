/**
 * The type and implementation of the query filter object, which can
 * be passed as an argument to query functions to constrain results.
 */

import {
  ComparisonOperatorExpression,
  Expression,
  ExtractTypeFromStringReference,
  Kysely,
  OperandValueExpressionOrList,
  ReferenceExpression,
  SelectType,
  WhereExpressionFactory,
  WhereInterface,
} from 'kysely';

type AnyWhereInterface = WhereInterface<any, any>;

/**
 * Type of the query filter object, which can be passed as an argument
 * to query functions to constrain results.
 */
export type QueryFilter<
  DB,
  TB extends keyof DB & string,
  RE extends ReferenceExpression<DB, TB>
> =
  | BinaryOperationFilter<DB, TB, RE>
  | FieldMatchingFilter<DB, TB, RE>
  | WhereExpressionFactory<DB, TB>
  | Expression<any>;

/**
 * A filter that is a binary operation, such as `eq` or `gt`.
 */
// TODO: delete when done adding unbracketed binary operations
export type BinaryOperationFilter<
  DB,
  TB extends keyof DB & string,
  RE extends ReferenceExpression<DB, TB>
> = [
  lhs: RE,
  op: ComparisonOperatorExpression,
  rhs: OperandValueExpressionOrList<DB, TB, RE>
];

/**
 * A filter that matches columns against the fields of an object.
 */
export type FieldMatchingFilter<
  DB,
  TB extends keyof DB & string,
  RE extends ReferenceExpression<DB, TB>
> = {
  [K in RE & string]?: SelectType<ExtractTypeFromStringReference<DB, TB, K>>;
};

/**
 * Returns a query builder that constrains the provided query builder
 * according to the provided query filter or binary operation.
 * @param base The Kysely mapper that is used to create references.
 * @param qb The query builder to constrain.
 * @param filterOrLHS The query filter or left-hand side of a binary operation.
 * @param op The operator of a binary operation.
 * @param rhs The right-hand side of a binary operation.
 * @returns A query builder constrained for the provided query filter
 *  or binary operation.
 */
export function applyQueryFilter<
  DB,
  TB extends keyof DB & string,
  QB extends AnyWhereInterface,
  RE extends ReferenceExpression<DB, TB>
>(
  db: Kysely<DB>,
  qb: QB,
  filterOrLHS: QueryFilter<DB, TB, RE> | RE,
  op?: ComparisonOperatorExpression,
  rhs?: OperandValueExpressionOrList<DB, TB, RE>
): QB {
  // Process a binary operation.
  if (op !== undefined) {
    return qb.where(filterOrLHS as RE, op, rhs!) as QB;
  }
  const filter = filterOrLHS as QueryFilter<DB, TB, RE>;

  // Process a where expression factory.
  if (typeof filter === 'function') {
    return qb.where(filter) as QB;
  }

  // Process a query expression filter. Check for expressions
  // first because they could potentially be plain objects.
  if ('expressionType' in filter) {
    return qb.where(filter) as QB;
  }

  // Process a field matching filter. `{}` matches all rows.
  if (filter.constructor === Object) {
    for (const [column, value] of Object.entries(filter)) {
      qb = qb.where(db.dynamic.ref(column), '=', value) as QB;
    }
    return qb as unknown as QB;
  }

  // Process a binary operation filter.
  if (Array.isArray(filter)) {
    return qb.where(...filter) as QB;
  }

  throw Error('Unrecognized query filter');
}
