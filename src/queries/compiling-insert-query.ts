import {
  Kysely,
  InsertQueryBuilder,
  Selectable,
  Selection,
  Insertable,
  QueryResult,
} from 'kysely';

import { SelectionColumn } from '../lib/type-utils';
import { ParameterizedQuery, QueryParameterMaker } from 'kysely-params';

/**
 * Compiling mapping query for inserting rows into a database table.
 */
export class CompilingMappingInsertQuery<
  DB,
  TB extends keyof DB & string,
  QB extends InsertQueryBuilder<DB, TB, any>,
  InsertedObject extends object,
  SelectedObject extends object,
  ReturnColumns extends SelectionColumn<DB, TB>[] | ['*'],
  InsertReturnsSelectedObject extends boolean,
  DefaultReturnObject extends object
> {
  #parameterizedQuery: ParameterizedQuery<
    Record<string, any>,
    QueryResult<any>
  > | null = null;
  #parameterizedQueryWithReturns: ParameterizedQuery<
    Record<string, any>,
    QueryResult<any>
  > | null = null;
  protected readonly returnColumns: ReturnColumns;
  protected qb: QB | null = null;
  protected remainingCompilations: number;

  /**
   * @param db Kysely database instance.
   * @param qb Kysely update query builder.
   * @param columnsToInsert The columns to insert into the table.
   * @param insertTransform A function that transforms the object to be
   *  inserted into a row for insertion into the database.
   * @param returnColumns The columns to return from the insert query.
   *  If `returnColumns` is `['*']`, returns all columns. If `returnColumns`
   *  is empty, returns nothing.
   * @param insertReturnTransform A function that transforms the object
   *  to be inserted and the returned row into the object to be returned
   *  from the insert query. When `InsertReturnsSelectedObject` is `true`,
   *  the returned object is of type `SelectedObject`; otherwise it is of
   *  type `DefaultReturnObject`.
   */
  constructor(
    protected readonly db: Kysely<DB>,
    qb: QB,
    columnsToInsert: (keyof Insertable<DB[TB]> & string)[],
    protected readonly insertTransform?: (
      obj: InsertedObject
    ) => Insertable<DB[TB]>,
    returnColumns?: ReturnColumns,
    protected readonly insertReturnTransform?: (
      source: InsertedObject,
      returns: ReturnColumns extends []
        ? never
        : Selection<DB, TB, ReturnColumns[number]>
    ) => InsertReturnsSelectedObject extends true
      ? SelectedObject
      : DefaultReturnObject
  ) {
    // TODO: can I just receive the final returnColumns?
    this.returnColumns = returnColumns ?? ([] as any);
    this.remainingCompilations = this.returnColumns.length === 0 ? 1 : 2;

    const parameterMaker = new QueryParameterMaker<any>();
    const paramedObj = Object.fromEntries(
      columnsToInsert.map((col) => [col, parameterMaker.param(col)])
    );
    this.qb = qb.values(paramedObj as any) as QB;
  }

  /**
   * Inserts the provided object into the table as a row, first transforming
   * it into a row via `insertTransform` (if defined). Also retrieves the
   * columns specified in `returnColumns`, returning them to the caller as
   * either `DefaultReturnObject` or `SelectedObject`, depending on whether
   * `InsertReturnsSelectedObject` is `true`, after transformation by
   * `insertReturnTransform`. If `returnColumns` is empty, returns `undefined`.
   *
   * On the first execution, compiles and discards the underlying Kysely
   * query builder to reduce memory usage. Subsequent executions reuse the
   * compiled query.
   * @returns If `returnColumns` is not empty, returns an object;
   *  otherwise returns `undefined`.
   */
  returnOne(
    obj: InsertedObject
  ): Promise<
    ReturnColumns extends []
      ? void
      : InsertReturnsSelectedObject extends true
      ? SelectedObject
      : DefaultReturnObject
  >;

  async returnOne(
    obj: InsertedObject
  ): Promise<
    | (InsertReturnsSelectedObject extends true
        ? SelectedObject
        : DefaultReturnObject)
    | null
    | void
  > {
    if (this.returnColumns.length === 0) {
      await this.run(obj);
      return;
    }
    if (this.#parameterizedQueryWithReturns === null) {
      this.#parameterizedQueryWithReturns = new ParameterizedQuery(
        this.getReturningQB()
      );
      if (--this.remainingCompilations === 0) {
        this.qb = null;
      }
    }
    const result = await this.#parameterizedQueryWithReturns.executeTakeFirst(
      this.db,
      this.applyInsertTransform(obj)
    );
    if (result === undefined) {
      throw Error('No row returned from insert expecting returned columns');
    }
    return this.insertReturnTransform === undefined
      ? (result as any)
      : this.insertReturnTransform(obj, result as any);
  }

  /**
   * Runs the query, inserting rows into the table without returning any
   * columns. On the first execution, compiles and discards the underlying
   * Kysely query builder to reduce memory usage. Subsequent executions reuse
   * the compiled query.
   * @param objOrObjs The object or objects to be inserted.
   * @returns Returns `true`; throws an exception on error.
   */
  async run(obj: InsertedObject): Promise<boolean> {
    if (this.#parameterizedQuery === null) {
      this.#parameterizedQuery = new ParameterizedQuery(this.qb!);
      if (--this.remainingCompilations === 0) {
        this.qb = null;
      }
    }
    const transformedObj = this.applyInsertTransform(obj);
    await this.#parameterizedQuery.execute(this.db, transformedObj);
    return true;
  }

  protected applyInsertTransform(obj: InsertedObject): Insertable<DB[TB]> {
    return this.insertTransform === undefined
      ? (obj as Insertable<DB[TB]>)
      : this.insertTransform(obj);
  }

  // TODO: might be able to make this shared; otherwise maybe embed it
  protected getReturningQB(): InsertQueryBuilder<DB, TB, any> {
    return this.returnColumns[0] == '*'
      ? this.qb!.returningAll()
      : this.qb!.returning(
          this.returnColumns as (keyof Selectable<DB[TB]> & string)[]
        );
  }
}
