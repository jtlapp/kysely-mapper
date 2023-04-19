import { Kysely, InsertQueryBuilder, Insertable } from 'kysely';

import { SelectionColumn } from '../lib/type-utils';
import { CompilingValuesQuery } from './compiling-values-query';
import { InsertTransforms } from '../mappers/table-mapper-transforms';

/**
 * Compiling mapping query for inserting rows into a database table.
 */
export class CompilingMappingInsertQuery<
  DB,
  TB extends keyof DB & string,
  QB extends InsertQueryBuilder<DB, TB, any>,
  InsertedObject extends object,
  SelectedObject extends object,
  ReturnColumns extends Readonly<SelectionColumn<DB, TB>[]> | ['*'],
  InsertReturnsSelectedObject extends boolean,
  DefaultReturn
> extends CompilingValuesQuery<
  DB,
  TB,
  QB,
  ReturnColumns,
  {},
  Insertable<DB[TB]>
> {
  constructor(
    db: Kysely<DB>,
    qb: QB,
    columnsToInsert: Readonly<(keyof Insertable<DB[TB]> & string)[]>,
    protected readonly transforms: Readonly<
      InsertTransforms<
        DB,
        TB,
        SelectedObject,
        InsertedObject,
        ReturnColumns,
        InsertReturnsSelectedObject,
        DefaultReturn
      >
    >,
    returnColumns: Readonly<ReturnColumns>
  ) {
    super(db, returnColumns);
    const parameterizedValues = this.getParameterizedObject(columnsToInsert);
    this.qb = qb.values(parameterizedValues) as QB;
  }

  /**
   * Inserts the provided object into the table as a row, first transforming
   * it into a row via `insertTransform` (if defined). Also retrieves the
   * columns specified in `returnColumns`, returning them to the caller as
   * either `DefaultReturn` or `SelectedObject`, depending on whether
   * `InsertReturnsSelectedObject` is `true`, after transformation by
   * `insertReturnTransform`. If `returnColumns` is empty, returns `undefined`.
   *
   * On the first execution, compiles and discards the underlying Kysely
   * query builder. Subsequent executions reuse the compiled query.
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
      : DefaultReturn
  >;

  async returnOne(
    obj: InsertedObject
  ): Promise<SelectedObject | DefaultReturn | void> {
    if (this.returnColumns.length === 0) {
      await this.run(obj);
      return;
    }
    const transformedObj = this.applyInsertTransform(obj);
    const compiledQuery = this.instantiateWithReturns({}, transformedObj);
    const result = await this.db.executeQuery(compiledQuery);
    if (result.rows.length === 0) {
      throw Error(
        'No row returned from compiled insert expecting returned columns'
      );
    }
    return this.transforms.insertReturnTransform === undefined
      ? (result.rows[0] as any)
      : this.transforms.insertReturnTransform(obj, result.rows[0] as any);
  }

  /**
   * Runs the query, inserting rows into the table without returning any
   * columns.
   *
   * On the first execution, compiles and discards the underlying Kysely
   * query builder. Subsequent executions reuse the compiled query.
   * @param objOrObjs The object or objects to be inserted.
   * @returns Returns `true`; throws an exception on error.
   */
  async run(obj: InsertedObject): Promise<boolean> {
    const transformedObj = this.applyInsertTransform(obj);
    const compiledQuery = this.instantiateNoReturns({}, transformedObj);
    await this.db.executeQuery(compiledQuery);
    return true;
  }

  protected applyInsertTransform(obj: InsertedObject): Insertable<DB[TB]> {
    return this.transforms.insertTransform === undefined
      ? (obj as Insertable<DB[TB]>)
      : this.transforms.insertTransform(obj);
  }
}
