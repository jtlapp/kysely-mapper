/**
 * Type utilities.
 */

import { Selectable, SelectArg, SelectExpression, Selection } from 'kysely';

/**
 * Type of the key tuple whose column names are given by `KA` and are
 * found in the table interface `T`. Supports up to 4 columns.
 * @typeparam T Table interface.
 * @typeparam KA Array of the key column names.
 */
export type KeyTuple<
  T,
  KA extends Readonly<(keyof Selectable<T> & string)[]>
> = KA[3] extends string
  ? [
      Selectable<T>[KA[0]],
      Selectable<T>[KA[1]],
      Selectable<T>[KA[2]],
      Selectable<T>[KA[3]]
    ]
  : KA[2] extends string
  ? [Selectable<T>[KA[0]], Selectable<T>[KA[1]], Selectable<T>[KA[2]]]
  : KA[1] extends string
  ? [Selectable<T>[KA[0]], Selectable<T>[KA[1]]]
  : [Selectable<T>[KA[0]]];

/**
 * Require specified properties of a type, leaving the rest optional.
 * @typeparam T Type to require properties from.
 * @typeparam K Keys of the properties to require.
 */
export type RequireSome<T, K extends keyof T> = Omit<T, K> &
  Required<Pick<T, K>>;

/**
 * Shorthand type for a selectable column, restricted to a column name.
 */
export type SelectableColumn<T> = keyof Selectable<T> & string;

/**
 * Selectable column name or column alias.
 */
export type SelectionColumn<DB, TB extends keyof DB & string> =
  | SelectableColumn<DB[TB]>
  | (SelectExpression<DB, TB> & `${SelectableColumn<DB[TB]>} as ${string}`);

/**
 * Type of a selected row, evaluating to all columns if `S` is `['*']`.
 */
export type SelectedRow<
  DB,
  TB extends keyof DB & string,
  SE extends SelectExpression<DB, TB>,
  S extends SelectArg<DB, TB, any> | ['*']
> = S extends ['*'] ? Selectable<DB[TB]> : Selection<DB, TB, SE>;

/**
 * Tuple of up to four selectable columns.
 */
export type SelectableColumnTuple<T> =
  | [SelectableColumn<T>]
  | [SelectableColumn<T>, SelectableColumn<T>]
  | [SelectableColumn<T>, SelectableColumn<T>, SelectableColumn<T>]
  | [
      SelectableColumn<T>,
      SelectableColumn<T>,
      SelectableColumn<T>,
      SelectableColumn<T>
    ];
