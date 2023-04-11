/**
 * Types copied verabitim from the Kysely source code.
 *
 * MIT License. Copyright (c) 2022 Sami Koskimäki.
 */

import { AnyColumn, Selectable } from 'kysely';

// copied from Kysely
export type AllSelection<DB, TB extends keyof DB> = Selectable<{
  [C in AnyColumn<DB, TB>]: {
    [T in TB]: C extends keyof DB[T] ? DB[T][C] : never;
  }[TB];
}>;
