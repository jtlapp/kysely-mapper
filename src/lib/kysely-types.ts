/**
 * Types copied verabitim from the Kysely source code.
 *
 * MIT License. Copyright (c) 2022 Sami Koskimäki.
 */

import { AnyColumn, Selectable } from 'kysely';
import { ExtractColumnType } from 'kysely/dist/cjs/util/type-utils';

// copied from Kysely
export type AllSelection<DB, TB extends keyof DB> = Selectable<{
  [C in AnyColumn<DB, TB>]: {
    [T in TB]: C extends keyof DB[T] ? DB[T][C] : never;
  }[TB];
}>;

// copied from Kysely
export type ExtractTypeFromStringSelectExpression<
  DB,
  TB extends keyof DB,
  SE extends string,
  A extends keyof any
> = SE extends `${infer SC}.${infer T}.${infer C} as ${infer RA}`
  ? RA extends A
    ? `${SC}.${T}` extends TB
      ? C extends keyof DB[`${SC}.${T}`]
        ? DB[`${SC}.${T}`][C]
        : never
      : never
    : never
  : SE extends `${infer T}.${infer C} as ${infer RA}`
  ? RA extends A
    ? T extends TB
      ? C extends keyof DB[T]
        ? DB[T][C]
        : never
      : never
    : never
  : SE extends `${infer C} as ${infer RA}`
  ? RA extends A
    ? C extends AnyColumn<DB, TB>
      ? ExtractColumnType<DB, TB, C>
      : never
    : never
  : SE extends `${infer SC}.${infer T}.${infer C}`
  ? C extends A
    ? `${SC}.${T}` extends TB
      ? C extends keyof DB[`${SC}.${T}`]
        ? DB[`${SC}.${T}`][C]
        : never
      : never
    : never
  : SE extends `${infer T}.${infer C}`
  ? C extends A
    ? T extends TB
      ? C extends keyof DB[T]
        ? DB[T][C]
        : never
      : never
    : never
  : SE extends A
  ? SE extends AnyColumn<DB, TB>
    ? ExtractColumnType<DB, TB, SE>
    : never
  : never;
