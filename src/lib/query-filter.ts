/**
 * The type and implementation of the query filter object, which can
 * be passed as an argument to query functions to constrain results.
 */

import {
  Expression,
  ExtractTypeFromStringReference,
  ReferenceExpression,
  SelectType,
  Selectable,
  WhereExpressionFactory,
} from 'kysely';

import { KeyTuple, SelectableColumnTuple } from './type-utils.js';

/**
 * Type of the query filter object, which can be passed as an argument
 * to query functions to constrain results. A filter can be any of the
 * following:
 *
 * - A key column value, which matches a single key column, if
 *   `KeyColumns` is a tuple with a single element.
 * - A key tuple, which matches multiple key columns, if `KeyColumns`
 *   is a tuple with multiple elements.
 * - An object, which matches columns against the object's fields. A
 *   field value may be an array, in which case the associated column ]
 *   matches any of the elements of the array.
 * - A raw SQL expression using Kysely's `sql` template literal tag.
 * - An arbitrary Kysely query expression.
 *
 * A filter is represented as a single value, but the methods that use
 * filters also accept three-argument binary operations.
 */
export type QueryFilter<
  DB,
  TB extends keyof DB & string,
  KeyColumns extends Readonly<SelectableColumnTuple<DB[TB]>> | Readonly<[]>,
  RE extends ReferenceExpression<DB, TB>
> =
  | (KeyColumns extends [string]
      ? KeyColumnFilter<DB, TB, KeyColumns[0]>
      : never)
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
    | Readonly<SelectType<ExtractTypeFromStringReference<DB, TB, K>>[]>;
};

/**
 * A filter that matches a single key column.
 */
type KeyColumnFilter<
  DB,
  TB extends keyof DB,
  K extends keyof Selectable<DB[TB]> & string
> = NonNullable<Selectable<DB[TB]>[K]>;
