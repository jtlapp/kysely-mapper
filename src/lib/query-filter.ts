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
  Selectable,
  WhereExpressionFactory,
  WhereInterface,
} from 'kysely';
import { KeyTuple, SelectableColumnTuple } from './type-utils';

type AnyWhereInterface = WhereInterface<any, any>;

type KeyColumnType<
  DB,
  TB extends keyof DB,
  K extends keyof Selectable<DB[TB]> & string
> = NonNullable<Selectable<DB[TB]>[K]>;

/**
 * Type of the query filter object, which can be passed as an argument
 * to query functions to constrain results.
 */
export type QueryFilter<
  DB,
  TB extends keyof DB & string,
  KeyColumns extends Readonly<SelectableColumnTuple<DB[TB]>> | [],
  RE extends ReferenceExpression<DB, TB>
> =
  | (KeyColumns extends [string] ? KeyColumnType<DB, TB, KeyColumns[0]> : never)
  | (KeyColumns extends [] ? never : Readonly<KeyTuple<DB[TB], KeyColumns>>)
  | FieldMatchingFilter<DB, TB, RE>
  | WhereExpressionFactory<DB, TB>
  | Expression<any>;

/**
 * A filter that matches columns against the fields of an object.
 */
export type FieldMatchingFilter<
  DB,
  TB extends keyof DB & string,
  RE extends ReferenceExpression<DB, TB>
> = {
  [K in RE & string]?:
    | SelectType<ExtractTypeFromStringReference<DB, TB, K>>
    | SelectType<ExtractTypeFromStringReference<DB, TB, K>>[];
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
  KeyColumns extends Readonly<SelectableColumnTuple<DB[TB]>> | [],
  QB extends AnyWhereInterface,
  RE extends ReferenceExpression<DB, TB>
>(
  db: Kysely<DB>,
  qb: QB,
  keyColumns: KeyColumns,
  filterOrLHS: QueryFilter<DB, TB, KeyColumns, RE> | RE,
  op?: ComparisonOperatorExpression,
  rhs?: OperandValueExpressionOrList<DB, TB, RE>
): QB {
  // Process a binary operation.
  if (op !== undefined) {
    return qb.where(filterOrLHS as RE, op, rhs!) as QB;
  }
  const filter = filterOrLHS as QueryFilter<DB, TB, KeyColumns, RE>;

  if (typeof filter === 'object') {
    // Process a key tuple filter.
    if (Array.isArray(filter)) {
      keyColumns.forEach((column, i) => {
        qb = qb.where(db.dynamic.ref(column), '=', filter[i]) as QB;
      });
      return qb;
    }

    // Process a query expression filter. Check for expressions
    // first because they could potentially be plain objects.
    if ('expressionType' in filter) {
      return qb.where(filter) as QB;
    }

    // Process a field matching filter. `{}` matches all rows.
    if (filter.constructor === Object) {
      for (const [column, value] of Object.entries(filter)) {
        if (Array.isArray(value)) {
          qb = qb.where(db.dynamic.ref(column), 'in', value) as QB;
        } else {
          qb = qb.where(db.dynamic.ref(column), '=', value) as QB;
        }
      }
      return qb as unknown as QB;
    }
  }

  // Process a where expression factory.
  if (typeof filter === 'function') {
    return qb.where(filter as any) as QB;
  }

  // Process a single key filter, expressed as a primitive value.
  if (keyColumns.length === 1) {
    return qb.where(db.dynamic.ref(keyColumns[0]), '=', filter) as QB;
  }

  throw Error('Unrecognized query filter');
}
