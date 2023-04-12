import {
  Kysely,
  InsertQueryBuilder,
  InsertResult,
  Selectable,
  Insertable,
} from 'kysely';

import { ObjectWithKeys } from '../lib/type-utils';

// TODO: see what else should be made readonly
// TODO: freeze objects

/**
 * Mapping query for inserting rows into a database table.
 */
export class MappingInsertQuery<
  DB,
  TB extends keyof DB & string,
  QB extends InsertQueryBuilder<DB, TB, InsertResult>,
  InsertedObject extends object,
  ReturnColumns extends (keyof Selectable<DB[TB]> & string)[] | ['*'],
  ReturnedObject extends object
> {
  protected readonly returnColumns: ReturnColumns;
  #returningQB: InsertQueryBuilder<DB, TB, any> | null = null;

  /**
   * @param db Kysely database instance.
   * @param qb Kysely update query builder.
   * @param insertTransform A function that transforms the object to be
   *  inserted into a row for insertion into the database.
   * @param returnColumns The columns to return from the insert query.
   *  If `returnColumns` is `['*']`, returns all columns. If `returnColumns`
   *  is empty, returns nothing.
   * @param insertReturnTransform A function that transforms the object
   *  to be inserted and the returned row into the object to be returned
   *  from the insert query.
   */
  constructor(
    protected readonly db: Kysely<DB>,
    protected readonly qb: QB,
    protected readonly insertTransform?: (
      obj: InsertedObject
    ) => Insertable<DB[TB]>,
    returnColumns?: ReturnColumns,
    protected readonly insertReturnTransform?: (
      source: InsertedObject,
      // TODO: reflect no return columns
      returns: ObjectWithKeys<Selectable<DB[TB]>, ReturnColumns>
    ) => ReturnedObject
  ) {
    this.returnColumns = returnColumns ?? ([] as any);
  }

  /**
   * Inserts the provided object or objects into the table as rows, first
   * transforming the objects into rows via `insertTransform` (if defined).
   * For each row inserted, retrieves the columns specified in `returnColumns`,
   * which are returned unless `insertReturnTransform` transforms them
   * into `ReturnedObject`. If `returnColumns` is empty, returns nothing.
   * @returns Returns a `ReturnedObject` for each inserted object. Will
   *  be an array when `objOrObjs` is an array, will be a single object
   *  otherwise. Returns nothing (void) if `returnColumns` is empty.
   */
  getReturns(
    obj: InsertedObject
  ): Promise<ReturnColumns extends [] ? void : ReturnedObject>;

  getReturns(
    objs: InsertedObject[]
  ): Promise<ReturnColumns extends [] ? void : ReturnedObject[]>;

  async getReturns(
    objOrObjs: InsertedObject | InsertedObject[]
  ): Promise<ReturnedObject | ReturnedObject[] | void> {
    if (this.returnColumns.length === 0) {
      await this.loadInsertions(this.qb, objOrObjs).execute();
    } else {
      const returns = await this.loadInsertions(
        this.getReturningQB(),
        objOrObjs
      ).execute();
      if (returns === undefined) {
        throw Error('No rows returned from insert expecting returned columns');
      }
      if (Array.isArray(objOrObjs)) {
        return this.insertReturnTransform === undefined
          ? (returns as any)
          : returns.map((row, i) =>
              this.insertReturnTransform!(objOrObjs[i], row as any)
            );
      }
      return this.insertReturnTransform === undefined
        ? (returns[0] as any)
        : this.insertReturnTransform(objOrObjs, returns[0] as any);
    }
  }

  /**
   * Inserts rows into the table without returning any columns.
   */
  async run(objOrObjs: InsertedObject | InsertedObject[]): Promise<void> {
    await this.loadInsertions(this.qb, objOrObjs).execute();
  }

  /**
   * Modifies the underlying Kysely query builder.
   * @param factory A function that takes the current query builder and
   *  returns a new query builder.
   */
  modify<NextQB extends InsertQueryBuilder<DB, TB, InsertResult>>(
    factory: (qb: QB) => NextQB
  ): MappingInsertQuery<
    DB,
    TB,
    NextQB,
    InsertedObject,
    ReturnColumns,
    ReturnedObject
  > {
    return new MappingInsertQuery(
      this.db,
      factory(this.qb),
      this.insertTransform,
      this.returnColumns,
      this.insertReturnTransform
    );
  }

  /**
   * Returns a query builder for inserting rows into the table and
   * returning values, caching the query builder for future use.
   * @returns A query builder for inserting rows into the table and
   *  returning values.
   */
  protected getReturningQB(): InsertQueryBuilder<DB, TB, any> {
    if (this.#returningQB === null) {
      this.#returningQB =
        this.returnColumns[0] == '*'
          ? this.qb.returningAll()
          : this.qb.returning(
              this.returnColumns as (keyof Selectable<DB[TB]> & string)[]
            );
    }
    return this.#returningQB;
  }

  /**
   * Loads the objects to be inserted into the query builder.
   * @param qb The query builder to load the objects into.
   * @param objOrObjs The object or objects to be inserted.
   * @returns The query builder with the objects loaded.
   */
  protected loadInsertions(
    qb: InsertQueryBuilder<DB, TB, InsertResult>,
    objOrObjs: InsertedObject | InsertedObject[]
  ): InsertQueryBuilder<DB, TB, InsertResult> {
    if (Array.isArray(objOrObjs)) {
      const transformedObjs =
        this.insertTransform === undefined
          ? (objOrObjs as Insertable<DB[TB]>[])
          : objOrObjs.map(this.insertTransform);
      // TS requires separate calls to values() for different arg types.
      return qb.values(transformedObjs);
    }
    const transformedObj =
      this.insertTransform === undefined
        ? (objOrObjs as Insertable<DB[TB]>)
        : this.insertTransform(objOrObjs);
    // TS requires separate calls to values() for different arg types.
    return qb.values(transformedObj);
  }
}
