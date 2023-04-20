import { Kysely, UpdateQueryBuilder, UpdateResult, Updateable } from 'kysely';

import { SelectionColumn } from '../lib/type-utils';
import { CompilingValuesQuery } from './compiling-values-query';
import { ParametersObject } from 'kysely-params';
import {
  CountTransform,
  UpdateTransforms,
} from '../mappers/table-mapper-transforms';

/**
 * Compiling mapping query for updating rows in a database table.
 */
export class CompilingMappingUpdateQuery<
  DB,
  TB extends keyof DB & string,
  QB extends UpdateQueryBuilder<DB, TB, TB, UpdateResult>,
  UpdatingObject extends object,
  UpdateReturnColumns extends Readonly<SelectionColumn<DB, TB>[]> | ['*'],
  ReturnCount,
  UpdateReturn,
  Parameters extends ParametersObject<Parameters>
> extends CompilingValuesQuery<
  DB,
  TB,
  QB,
  UpdateReturnColumns,
  Parameters,
  Updateable<DB[TB]>
> {
  constructor(
    db: Kysely<DB>,
    qb: QB,
    columnsToUpdate: Readonly<(keyof Updateable<DB[TB]> & string)[]>,
    protected readonly transforms: Readonly<
      CountTransform<ReturnCount> &
        UpdateTransforms<
          DB,
          TB,
          UpdatingObject,
          UpdateReturnColumns,
          UpdateReturn
        >
    >,
    returnColumns: Readonly<UpdateReturnColumns>
  ) {
    super(db, returnColumns);
    const parameterizedValues = this.getParameterizedObject(columnsToUpdate);
    this.qb = qb.set(parameterizedValues) as QB;
  }

  /**
   * Runs the query, returning the number of rows updated, in the required
   * client representation. Accepts values for any parameters embedded in
   * the query.
   *
   * On the first execution, compiles and discards the underlying Kysely
   * query builder. Subsequent executions reuse the compiled query.
   * @param obj The object which which to update the rows.
   * @returns Number of rows updated, in client-requested representation.
   */
  async returnCount(
    params: Parameters,
    obj: UpdatingObject
  ): Promise<ReturnCount> {
    const transformedObj = this.applyUpdateTransform(obj);
    const compiledQuery = this.instantiateNoReturns(params, transformedObj);
    const result = await this.db.executeQuery(compiledQuery);
    return this.transforms.countTransform === undefined
      ? (result.numAffectedRows as ReturnCount)
      : this.transforms.countTransform(result.numAffectedRows!);
  }

  /**
   * Updates rows with the values that result from transforming the object via
   * `insertTransform` (if defined). For each row updated, retrieves the
   * columns specified in `returnColumns` (if defined), returning them to the
   * caller as an `UpdateReturn`, after transformation by any provided
   * `updateReturnTransform`. If `returnColumns` is empty, returns `undefined`.
   * Accepts values for any parameters embedded in the query.
   *
   * On the first execution, compiles and discards the underlying Kysely
   * query builder. Subsequent executions reuse the compiled query.
   * @returns If `returnColumns` is not empty, returns an array containing one
   *  object for each row updated; otherwise returns `undefined`.
   */
  returnAll(
    params: Parameters,
    obj: UpdatingObject
  ): Promise<UpdateReturnColumns extends [] ? void : UpdateReturn[]>;

  async returnAll(
    params: Parameters,
    obj: UpdatingObject
  ): Promise<UpdateReturn[] | void> {
    if (this.returnColumns.length === 0) {
      await this.run(params, obj as UpdatingObject);
      return;
    }
    const transformedObj = this.applyUpdateTransform(obj as UpdatingObject);
    const compiledQuery = this.instantiateWithReturns(params, transformedObj);
    const result = await this.db.executeQuery(compiledQuery);
    return this.transforms.updateReturnTransform === undefined
      ? (result.rows as any)
      : result.rows.map((row) =>
          this.applyUpdateReturnTransform(obj as UpdatingObject, row as any)
        );
  }

  /**
   * Updates rows with the values that result from transforming the object via
   * `updateTransform` (if defined). For the first row updated, retrieves the
   * columns specified in `returnColumns` (if defined), returning them to the
   * caller as an `UpdateReturn`, after transformation by any provided
   * `updateReturnTransform`. If `returnColumns` is empty, returns `undefined`.
   * Accepts values for any parameters embedded in the query.
   *
   * On the first execution, compiles and discards the underlying Kysely
   * query builder. Subsequent executions reuse the compiled query.
   * @returns If `returnColumns` is empty, returns `undefined`. Otherwise,
   *  returns the first object if at least one row was updated, or `null` if
   *  no rows were updated.
   */
  returnOne(
    params: Parameters,
    obj: UpdatingObject
  ): Promise<UpdateReturnColumns extends [] ? void : UpdateReturn | null>;

  async returnOne(
    params: Parameters,
    obj: UpdatingObject
  ): Promise<UpdateReturn | null | void> {
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
   * Runs the query, updating rows, without returning any columns. Accepts
   * values for any parameters embedded in the query.
   *
   * On the first execution, compiles and discards the underlying Kysely
   * query builder. Subsequent executions reuse the compiled query.
   * @param obj The object which which to update the rows.
   * @returns `true` if any rows were updated, `false` otherwise.
   */
  async run(params: Parameters, obj: UpdatingObject): Promise<boolean> {
    return (await this.returnCount(params, obj)) !== 0;
  }

  protected applyUpdateTransform(obj: UpdatingObject): Updateable<DB[TB]> {
    return this.transforms.updateTransform === undefined
      ? (obj as Updateable<DB[TB]>)
      : this.transforms.updateTransform(obj);
  }

  protected applyUpdateReturnTransform(source: UpdatingObject, returns: any) {
    return this.transforms.updateReturnTransform === undefined
      ? (returns as any)
      : this.transforms.updateReturnTransform(source, returns);
  }
}
