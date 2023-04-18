import {
  Kysely,
  Selectable,
  CompiledQuery,
  Compilable,
  ReturningInterface,
} from 'kysely';

import { SelectionColumn } from '../lib/type-utils';
import { ParametersObject, ParameterizedValue } from 'kysely-params';

/**
 * Parameterized value placeholder for inserted or added column values.
 */
class ColumnParameter<Values> {
  constructor(public readonly columnName: keyof Values & string) {}
}

/**
 * Base class for compilable inserting and updating mapping queriees.
 */
export class CompilingValuesQuery<
  DB,
  TB extends keyof DB & string,
  QB extends ReturningInterface<DB, TB, any> & Compilable<any>,
  ReturnColumns extends Readonly<SelectionColumn<DB, TB>[]> | ['*'],
  P extends ParametersObject<P>,
  Values extends Record<string, any>
> {
  protected qb: QB | null = null;
  #compiledQueryNoReturns?: CompiledQuery<any>;
  #compiledQueryWithReturns?: CompiledQuery<any>;

  constructor(
    protected readonly db: Kysely<DB>,
    protected readonly returnColumns: Readonly<ReturnColumns>
  ) {}

  protected getParameterizedObject(columnsToAllow: (keyof Values & string)[]) {
    return Object.fromEntries(
      columnsToAllow.map((col) => [col, new ColumnParameter<Values>(col)])
    ) as Values;
  }

  protected instantiateNoReturns(params: P, obj: Values): CompiledQuery<any> {
    this.compileQueries();
    return this.instantiate(this.#compiledQueryNoReturns!, params, obj);
  }

  protected instantiateWithReturns(params: P, obj: Values): CompiledQuery<any> {
    this.compileQueries();
    return this.instantiate(this.#compiledQueryWithReturns!, params, obj);
  }

  // TODO: maybe embed this if doesn't end up shared
  private getReturningQB(): QB {
    return this.returnColumns[0 as number] == '*'
      ? (this.qb!.returningAll() as QB)
      : (this.qb!.returning(
          this.returnColumns as Readonly<(keyof Selectable<DB[TB]> & string)[]>
        ) as QB);
  }

  private compileQueries(): void {
    if (this.qb !== null) {
      this.#compiledQueryNoReturns = this.qb!.compile();
      this.#compiledQueryWithReturns = this.getReturningQB().compile();
      this.qb = null;
    }
  }

  private instantiate(
    compiledQuery: CompiledQuery<any>,
    params: P,
    obj: Values
  ): CompiledQuery<any> {
    return {
      query: compiledQuery.query,
      sql: compiledQuery.sql,
      parameters: compiledQuery.parameters.map((value) =>
        value instanceof ColumnParameter
          ? obj[value.columnName]
          : value instanceof ParameterizedValue
          ? params[value.parameterName as keyof P]
          : value
      ),
    };
  }
}
