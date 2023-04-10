/**
 * Type utilities.
 */

// TODO: drop types I'm not using

import {
  Compilable,
  Selectable,
  SelectArg,
  SelectExpression,
  Selection,
  SelectType,
} from "kysely";

import {
  AllSelection,
  ExtractTypeFromStringSelectExpression,
} from "./kysely-types";

/**
 * Evaluates to a type containing all possible selectable columns,
 * including aliased columns.
 */
export type AllColumns<
  DB,
  TB extends keyof DB & string,
  ColumnAliases extends string[]
> = AllSelection<DB, TB> & AliasedSubset<DB, TB, ColumnAliases>;

/**
 * Converts a key of object O to a string of the form `${K} as ${string}`,
 * where K is the key.
 * @typeparam O Object whose keys are to be converted to strings.
 * @typeparam K Key of O.
 */

/**
 * Type representing an empty object. Use for clarity.
 */
export type EmptyObject = Record<string, never>;

/**
 * Type of the primary key tuple whose column names are given by `KA` and are
 * found in the table interface `T`. Supports up to 4 columns.
 * @typeparam T Table interface.
 * @typeparam KA Array of the primary key column names.
 */
export type KeyTuple<
  T,
  KA extends (keyof Selectable<T> & string)[]
> = Selectable<T>[KA[3]] extends string
  ? [
      Selectable<T>[KA[0]],
      Selectable<T>[KA[1]],
      Selectable<T>[KA[2]],
      Selectable<T>[KA[3]]
    ]
  : Selectable<T>[KA[2]] extends string
  ? [Selectable<T>[KA[0]], Selectable<T>[KA[1]], Selectable<T>[KA[2]]]
  : Selectable<T>[KA[1]] extends string
  ? [Selectable<T>[KA[0]], Selectable<T>[KA[1]]]
  : [Selectable<T>[KA[0]]];

/**
 * Evaluates to the subset of a the given object having the keys in
 * the provided string array of key names.
 */
export type ObjectWithKeys<O, KeyArray extends string[]> = {
  [K in KeyArray[number]]: K extends keyof O ? O[K] : never;
};

/**
 * Evalutes to the type of the query builder output.
 */
export type QueryBuilderOutput<QB> = QB extends Compilable<infer O> ? O : never;

/**
 * Type that turns the given properties of the given object into required
 * properties.
 * @typeparam O Object type.
 * @typeparam K Array of property names.
 */
export type RequireProperties<O, K extends keyof O> = Omit<O, K> & {
  [P in K]-?: O[P];
};

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
 * Type of a selected row, evaluating to all columns if `S` is `["*"]`.
 */
export type SelectedRow<
  DB,
  TB extends keyof DB & string,
  SE extends SelectExpression<DB, TB>,
  S extends SelectArg<DB, TB, any> | ["*"]
> = S extends ["*"] ? Selectable<DB[TB]> : Selection<DB, TB, SE>;

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

/**
 * Evaluates to an object consisting only of aliased columns.
 */
type AliasedSubset<
  DB,
  TB extends keyof DB & string,
  ColumnAliases extends string[]
> = ColumnAliases extends []
  ? object
  : {
      [A in ColumnAliases[number] extends `${string} as ${infer A}`
        ? A
        : never]: SelectType<
        ExtractTypeFromStringSelectExpression<DB, TB, ColumnAliases[number], A>
      >;
    };
