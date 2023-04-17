import { Kysely, UpdateQueryBuilder, UpdateResult, Updateable } from 'kysely';

import { SelectedRow, SelectionColumn } from '../lib/type-utils';
import { CompilingValuesQuery } from './compiling-values-query';
import { ParametersObject } from 'kysely-params';

// TODO: revise jsdoc "on first execution" to refer to the correct
// first thing, because it's not just a call to the method

/**
 * Compiling mapping query for updating rows in a database table.
 */
export class CompilingMappingUpdateQuery<
  DB,
  TB extends keyof DB & string,
  QB extends UpdateQueryBuilder<DB, TB, TB, UpdateResult>,
  UpdatingObject extends object,
  SelectedObject extends object,
  ReturnColumns extends SelectionColumn<DB, TB>[] | ['*'],
  ReturnCount,
  UpdateReturnsSelectedObjectWhenProvided extends boolean,
  DefaultReturnObject extends object,
  P extends ParametersObject<P>
> extends CompilingValuesQuery<
  DB,
  TB,
  QB,
  ReturnColumns,
  P,
  Updateable<DB[TB]>
> {
  /**
   * TODO: look into eliminating duplicate jsdocs
   * @param db Kysely database instance.
   * @param qb Kysely update query builder.
   * @param countTransform A function that transforms the number of updated
   *  rows into the representation required by the client.
   * @param updateTransform A function that transforms the updating object
   *  into a row for updating the database.
   * @param returnColumns The columns to return from the update query.
   *  If `returnColumns` is `['*']`, returns all columns. If `returnColumns`
   *  is empty, returns nothing.
   * @param updateReturnTransform A function that transforms the returned
   *  row into the object to be returned from the update query. When
   * `UpdateReturnsSelectedObjectWhenProvided` is `true`, the returned
   *  object is of type `SelectedObject` if the function's input is also
   *  of this type; otherwise it is of type `DefaultReturnObject`.
   */
  constructor(
    protected readonly db: Kysely<DB>,
    qb: QB,
    columnsToUpdate: (keyof Updateable<DB[TB]> & string)[],
    protected readonly countTransform: (count: bigint) => ReturnCount,
    protected readonly updateTransform?: (
      update: UpdatingObject
    ) => Updateable<DB[TB]>,
    returnColumns?: ReturnColumns,
    protected readonly updateReturnTransform?: (
      source: UpdatingObject,
      returns: ReturnColumns extends []
        ? never
        : SelectedRow<
            DB,
            TB,
            ReturnColumns extends ['*'] ? never : ReturnColumns[number],
            ReturnColumns
          >
    ) => UpdateReturnsSelectedObjectWhenProvided extends true
      ? UpdatingObject extends SelectedObject
        ? SelectedObject
        : DefaultReturnObject
      : DefaultReturnObject
  ) {
    super(db, returnColumns);
    const parameterizedValues = this.getParameterizedObject(columnsToUpdate);
    this.qb = qb.set(parameterizedValues) as QB;
  }

  /**
   * Runs the query, returning the number of rows updated, in
   * the required client representation.
   * @param obj The object which which to update the rows.
   * @returns Number of rows updated, in client-requested representation.
   */
  // TODO: rename all getCount()s to returnCount()s
  async getCount(params: P, obj: UpdatingObject): Promise<ReturnCount> {
    const transformedObj = this.applyUpdateTransform(obj);
    const compiledQuery = this.instantiateNoReturns(params, transformedObj);
    const result = await this.db.executeQuery(compiledQuery);
    return this.countTransform(result.numAffectedRows!);
  }

  /**
   * Updates rows with the values that result from transforming the object via
   * `insertTransform` (if defined). For each row updated, retrieves the
   * columns specified in `returnColumns` (if defined), returning them to the
   * caller as either `DefaultReturnObject` or `SelectedObject`, depending
   * on whether `UpdateReturnsSelectedObjectWhenProvided` is `true` and the
   * provided object is a `SelectedObject`, after transformation by
   * `updateReturnTransform`. If `returnColumns` is empty, returns `undefined`.
   * @returns If `returnColumns` is not empty, returns an array containing one
   *  object for each row updated; otherwise returns `undefined`.
   */
  returnAll(
    params: P,
    obj: SelectedObject
  ): Promise<
    ReturnColumns extends []
      ? void
      : UpdateReturnsSelectedObjectWhenProvided extends true
      ? SelectedObject[]
      : DefaultReturnObject[]
  >;

  returnAll(
    params: P,
    obj: UpdatingObject
  ): Promise<ReturnColumns extends [] ? void : DefaultReturnObject[]>;

  async returnAll(
    params: P,
    obj: UpdatingObject | SelectedObject
  ): Promise<SelectedObject[] | DefaultReturnObject[] | void> {
    if (this.returnColumns.length === 0) {
      await this.run(params, obj as UpdatingObject);
      return;
    }
    const transformedObj = this.applyUpdateTransform(obj as UpdatingObject);
    const compiledQuery = this.instantiateWithReturns(params, transformedObj);
    const result = await this.db.executeQuery(compiledQuery);
    return this.updateReturnTransform === undefined
      ? (result.rows as any)
      : result.rows.map((row) =>
          this.applyUpdateReturnTransform(obj as UpdatingObject, row as any)
        );
  }

  /**
   * Updates rows with the values that result from transforming the object via
   * `updateTransform` (if defined). For the first row updated, retrieves the
   * columns specified in `returnColumns` (if defined), returning them to the
   * caller as either `DefaultReturnObject` or `SelectedObject`, depending
   * on whether `UpdateReturnsSelectedObjectWhenProvided` is `true` and the
   * provided object is a `SelectedObject`, after transformation by
   * `updateReturnTransform`. If `returnColumns` is empty, returns `undefined`.
   *
   * On the first execution, compiles and discards the underlying Kysely
   * query builder to reduce memory usage. Subsequent executions reuse the
   * compiled query.
   * @returns If `returnColumns` is empty, returns `undefined`. Otherwise,
   *  returns the first object if at least one row was updated, or `null` if
   *  no rows were updated.
   */
  returnOne(
    params: P,
    obj: SelectedObject
  ): Promise<
    ReturnColumns extends []
      ? void
      :
          | (UpdateReturnsSelectedObjectWhenProvided extends true
              ? SelectedObject
              : DefaultReturnObject)
          | null
  >;

  returnOne(
    params: P,
    obj: UpdatingObject
  ): Promise<ReturnColumns extends [] ? void : DefaultReturnObject | null>;

  async returnOne(
    params: P,
    obj: UpdatingObject | SelectedObject
  ): Promise<SelectedObject | DefaultReturnObject | null | void> {
    if (this.returnColumns.length === 0) {
      await this.run(params, obj as UpdatingObject);
      return;
    }
    const transformedObj = this.applyUpdateTransform(obj as UpdatingObject);
    const compiledQuery = this.instantiateWithReturns(params, transformedObj);
    const result = await this.db.executeQuery(compiledQuery);
    if (result.rows.length === 0) {
      return null;
    }
    return this.applyUpdateReturnTransform(
      obj as UpdatingObject,
      result.rows[0] as any
    );
  }

  /**
   * Runs the query, updating rows, without returning any columns. On the
   * first execution, compiles and discards the underlying Kysely query
   * builder to reduce memory usage. Subsequent executions reuse the
   * compiled query.
   * @param obj The object which which to update the rows.
   * @returns `true` if any rows were updated, `false` otherwise.
   */
  async run(params: P, obj: UpdatingObject): Promise<boolean> {
    return (await this.getCount(params, obj)) !== 0;
  }

  protected applyUpdateTransform(obj: UpdatingObject): Updateable<DB[TB]> {
    return this.updateTransform === undefined
      ? (obj as Updateable<DB[TB]>)
      : this.updateTransform(obj);
  }

  protected applyUpdateReturnTransform(source: UpdatingObject, returns: any) {
    return this.updateReturnTransform === undefined
      ? (returns as any)
      : this.updateReturnTransform(source, returns);
  }
}
