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
  Parameters extends ParametersObject<Parameters>,
  Values extends Record<string, any>
> {
  protected qb: QB | null = null;
  #compiledQueryNoReturns?: CompiledQuery<any>;
  #compiledQueryWithReturns?: CompiledQuery<any>;

  constructor(
    protected readonly db: Kysely<DB>,
    protected readonly returnColumns: Readonly<ReturnColumns>
  ) {}

  protected getParameterizedObject(
    columnsToAllow: Readonly<(keyof Values & string)[]>
  ) {
    return Object.fromEntries(
      columnsToAllow.map((col) => [col, new ColumnParameter<Values>(col)])
    ) as Values;
  }

  protected instantiateNoReturns(
    params: Parameters,
    obj: Values
  ): CompiledQuery<any> {
    this.compileQueries();
    return this.instantiate(this.#compiledQueryNoReturns!, params, obj);
  }

  protected instantiateWithReturns(
    params: Parameters,
    obj: Values
  ): CompiledQuery<any> {
    this.compileQueries();
    return this.instantiate(this.#compiledQueryWithReturns!, params, obj);
  }

  private compileQueries(): void {
    if (this.qb !== null) {
      this.#compiledQueryNoReturns = this.qb!.compile();
      this.#compiledQueryWithReturns = this.getReturningQB().compile();
      this.qb = null;
    }
  }

  private getReturningQB(): QB {
    return this.returnColumns[0 as number] == '*'
      ? (this.qb!.returningAll() as QB)
      : (this.qb!.returning(
          this.returnColumns as Readonly<(keyof Selectable<DB[TB]> & string)[]>
        ) as QB);
  }

  private instantiate(
    compiledQuery: CompiledQuery<any>,
    params: Parameters,
    obj: Values
  ): CompiledQuery<any> {
    return {
      query: compiledQuery.query,
      sql: compiledQuery.sql,
      parameters: compiledQuery.parameters.map((value) =>
        value instanceof ColumnParameter
          ? this.verifiedValue(obj, value.columnName)
          : value instanceof ParameterizedValue
          ? params[value.parameterName as keyof Parameters]
          : value
      ),
    };
  }

  private verifiedValue(obj: any, column: string): any {
    const value = obj[column];
    // ensure the output of the applied transform works for the present query
    if (value === undefined) {
      throw new Error(
        `Specified column '${column}' missing from values object (compiled)`
      );
    }
    return value;
  }
}
