import {
  Kysely,
  InsertQueryBuilder,
  InsertResult,
  Selectable,
  Insertable,
} from 'kysely';

import { SelectionColumn } from '../lib/type-utils';
import { InsertTransforms } from '../mappers/table-mapper-transforms';

/**
 * Mapping query for inserting rows into a database table.
 */
export class MappingInsertQuery<
  DB,
  TB extends keyof DB & string,
  QB extends InsertQueryBuilder<DB, TB, InsertResult>,
  InsertedObject extends object,
  InsertReturnColumns extends Readonly<SelectionColumn<DB, TB>[]> | ['*'],
  InsertReturn
> {
  #returningQB: InsertQueryBuilder<DB, TB, any> | null = null;

  constructor(
    protected readonly db: Kysely<DB>,
    protected readonly qb: QB,
    protected readonly transforms: Readonly<
      InsertTransforms<
        DB,
        TB,
        InsertedObject,
        InsertReturnColumns,
        InsertReturn
      >
    >,
    protected readonly returnColumns: Readonly<InsertReturnColumns>
  ) {}

  /**
   * Modifies the underlying Kysely query builder.
   * @param factory A function that takes the current query builder and
   *  returns a new query builder.
   */
  modify<NextQB extends InsertQueryBuilder<DB, TB, any>>(
    factory: (qb: QB) => NextQB
  ): MappingInsertQuery<
    DB,
    TB,
    NextQB,
    InsertedObject,
    InsertReturnColumns,
    InsertReturn
  > {
    return new MappingInsertQuery(
      this.db,
      factory(this.qb),
      this.transforms,
      this.returnColumns
    );
  }

  /**
   * Inserts the provided objects into the table as rows, first transforming
   * them into rows via `insertTransform` (if defined). For each row inserted,
   * retrieves the columns specified in `returnColumns`, returning them to
   * the caller as `InsertReturn`, after transformation by
   * `insertReturnTransform`. If `returnColumns` is empty, returns `undefined`.
   * @returns If `returnColumns` is not empty, returns an array containing one
   *  object for each inserted object; otherwise returns `undefined`.
   */
  returnAll(
    objs: InsertedObject[]
  ): Promise<InsertReturnColumns extends [] ? void : InsertReturn[]>;

  async returnAll(objs: InsertedObject[]): Promise<InsertReturn[] | void> {
    if (this.returnColumns.length === 0) {
      await this.loadInsertedObjects(this.qb, objs).execute();
      return;
    }
    const returns = await this.loadInsertedObjects(
      this.getReturningQB(),
      objs
    ).execute();
    return this.transforms.insertReturnTransform === undefined
      ? (returns as any)
      : returns.map((row, i) =>
          this.transforms.insertReturnTransform!(objs[i], row as any)
        );
  }

  /**
   * Inserts the provided object into the table as a row, first transforming
   * it into a row via `insertTransform` (if defined). Also retrieves the
   * columns specified in `returnColumns`, returning them to the caller as
   * `InsertReturn`, after transformation by `insertReturnTransform`.
   * If `returnColumns` is empty, returns `undefined`.
   * @returns If `returnColumns` is not empty, returns an object;
   *  otherwise returns `undefined`.
   */
  returnOne(
    obj: InsertedObject
  ): Promise<InsertReturnColumns extends [] ? void : InsertReturn>;

  async returnOne(obj: InsertedObject): Promise<InsertReturn | void> {
    if (this.returnColumns.length === 0) {
      await this.loadInsertedObjects(this.qb, obj).execute();
      return;
    }
    const result = await this.loadInsertedObjects(
      this.getReturningQB(),
      obj
    ).executeTakeFirst();
    return this.transforms.insertReturnTransform === undefined
      ? (result as any)
      : this.transforms.insertReturnTransform(obj, result as any);
  }

  /**
   * Runs the query, inserting rows into the table without returning any columns.
   * @param objOrObjs The object or objects to be inserted.
   * @returns Returns `true`; throws an exception on error.
   */
  async run(objOrObjs: InsertedObject | InsertedObject[]): Promise<boolean> {
    await this.loadInsertedObjects(this.qb, objOrObjs).execute();
    return true;
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
        this.returnColumns[0 as number] == '*'
          ? this.qb.returningAll()
          : this.qb.returning(
              this.returnColumns as Readonly<
                (keyof Selectable<DB[TB]> & string)[]
              >
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
  protected loadInsertedObjects(
    qb: InsertQueryBuilder<DB, TB, InsertResult>,
    objOrObjs: InsertedObject | InsertedObject[]
  ): InsertQueryBuilder<DB, TB, InsertResult> {
    if (Array.isArray(objOrObjs)) {
      const transformedObjs =
        this.transforms.insertTransform === undefined
          ? (objOrObjs as Insertable<DB[TB]>[])
          : objOrObjs.map(this.transforms.insertTransform);
      // TS requires separate calls to values() for different arg types.
      return this.setColumnValues(qb, transformedObjs);
    }
    const transformedObj =
      this.transforms.insertTransform === undefined
        ? (objOrObjs as Insertable<DB[TB]>)
        : this.transforms.insertTransform(objOrObjs);
    // TS requires separate calls to values() for different arg types.
    return this.setColumnValues(qb, transformedObj);
  }

  /**
   * Sets the values of the inserted columns.
   * @param qb The query builder to set the values into.
   * @param objOrObjs The object or objects of column-value pairs
   *  to be inserted.
   */
  protected setColumnValues(
    qb: InsertQueryBuilder<DB, TB, InsertResult>,
    objOrObjs: Insertable<DB[TB]> | Insertable<DB[TB]>[]
  ): InsertQueryBuilder<DB, TB, InsertResult> {
    return qb.values(objOrObjs);
  }
}
