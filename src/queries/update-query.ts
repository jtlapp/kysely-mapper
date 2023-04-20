import {
  Kysely,
  Selectable,
  UpdateQueryBuilder,
  UpdateResult,
  Updateable,
} from 'kysely';
import { SelectionColumn } from '../lib/type-utils';
import {
  CountTransform,
  UpdateTransforms,
} from '../mappers/table-mapper-transforms';

/**
 * Mapping query for updating rows from a database table.
 */
export class MappingUpdateQuery<
  DB,
  TB extends keyof DB & string,
  QB extends UpdateQueryBuilder<DB, TB, TB, UpdateResult>,
  UpdatingObject extends object,
  UpdateReturnColumns extends Readonly<SelectionColumn<DB, TB>[]> | ['*'],
  ReturnCount,
  UpdateReturn
> {
  #returningQB: UpdateQueryBuilder<DB, TB, TB, any> | null = null;

  constructor(
    readonly db: Kysely<DB>,
    readonly qb: QB,
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
    protected readonly returnColumns: Readonly<UpdateReturnColumns>
  ) {}

  /**
   * Modifies the underlying Kysely query builder.
   * @param factory A function that takes the current query builder and
   *  returns a new query builder.
   */
  modify<NextQB extends UpdateQueryBuilder<DB, TB, TB, any>>(
    factory: (qb: QB) => NextQB
  ): MappingUpdateQuery<
    DB,
    TB,
    NextQB,
    UpdatingObject,
    UpdateReturnColumns,
    ReturnCount,
    UpdateReturn
  > {
    return new MappingUpdateQuery(
      this.db,
      factory(this.qb),
      this.transforms,
      this.returnColumns
    );
  }

  /**
   * Runs the query, returning the number of rows updated, in
   * the required client representation.
   * @param obj The object which which to update the rows.
   * @returns Number of rows updated, in client-requested representation.
   */
  async returnCount(obj: UpdatingObject): Promise<ReturnCount> {
    const result = await this.loadUpdatingObject(
      this.qb,
      obj
    ).executeTakeFirst();
    return this.transforms.countTransform === undefined
      ? (result.numUpdatedRows as ReturnCount)
      : this.transforms.countTransform(result.numUpdatedRows);
  }

  /**
   * Updates rows with the values that result from transforming the object via
   * `updateTransform` (if defined). For each row updated, retrieves the
   * columns specified in `returnColumns` (if defined), returning them to the
   * caller as an `UpdateReturn`, after transformation by any provided
   * `updateReturnTransform`. If `returnColumns` is empty, returns `undefined`.
   * @returns If `returnColumns` is not empty, returns an array containing one
   *  object for each row updated; otherwise returns `undefined`.
   */
  returnAll(
    obj: UpdatingObject
  ): Promise<UpdateReturnColumns extends [] ? void : UpdateReturn[]>;

  async returnAll(obj: UpdatingObject): Promise<UpdateReturn[] | void> {
    if (this.returnColumns.length === 0) {
      await this.loadUpdatingObject(this.qb, obj as UpdatingObject).execute();
      return;
    }
    const returns = await this.loadUpdatingObject(
      this.getReturningQB(),
      obj as UpdatingObject
    ).execute();
    return this.transforms.updateReturnTransform === undefined
      ? (returns as any)
      : returns.map((row) =>
          this.transforms.updateReturnTransform!(
            obj as UpdatingObject,
            row as any
          )
        );
  }

  /**
   * Updates rows with the values that result from transforming the object via
   * `updateTransform` (if defined). For the first row updated, retrieves the
   * columns specified in `returnColumns` (if defined), returning them to the
   * caller as an `UpdateReturn`, after transformation by any provided
   * `updateReturnTransform`. If `returnColumns` is empty, returns `undefined`.
   * @returns If `returnColumns` is empty, returns `undefined`. Otherwise,
   *  returns the first object if at least one row was updated, or `null` if
   *  no rows were updated.
   */
  returnOne(
    obj: UpdatingObject
  ): Promise<UpdateReturnColumns extends [] ? void : UpdateReturn | null>;

  async returnOne(obj: UpdatingObject): Promise<UpdateReturn | null | void> {
    if (this.returnColumns.length === 0) {
      await this.loadUpdatingObject(this.qb, obj as UpdatingObject).execute();
      return;
    }
    const returns = await this.loadUpdatingObject(
      this.getReturningQB(),
      obj as UpdatingObject
    ).execute();
    if (returns.length === 0) {
      return null;
    }
    return this.transforms.updateReturnTransform === undefined
      ? (returns[0] as any)
      : this.transforms.updateReturnTransform!(
          obj as UpdatingObject,
          returns[0] as any
        );
  }

  /**
   * Runs the query, updating rows, without returning any columns.
   * @param obj The object which which to update the rows.
   * @returns `true` if any rows were updated, `false` otherwise.
   */
  async run(obj: UpdatingObject): Promise<boolean> {
    const results = await this.loadUpdatingObject(
      this.qb,
      obj
    ).executeTakeFirst();
    return results.numUpdatedRows !== BigInt(0);
  }

  /**
   * Returns a query builder for updating rows in the table and
   * returning values, caching the query builder for future use.
   * @returns A query builder for updating rows in the table and
   *  returning values.
   */
  protected getReturningQB(): UpdateQueryBuilder<DB, TB, TB, any> {
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
   * Loads the object with which to update rows.
   * @param qb The query builder to load the objects into.
   * @param obj The object with which to update rows.
   * @returns The query builder with the object loaded.
   */
  protected loadUpdatingObject(
    qb: UpdateQueryBuilder<DB, TB, TB, UpdateResult>,
    obj: UpdatingObject
  ): UpdateQueryBuilder<DB, TB, TB, UpdateResult> {
    const transformedObj =
      this.transforms.updateTransform === undefined
        ? obj
        : this.transforms.updateTransform(obj);
    return this.setColumnValues(qb, transformedObj);
  }

  /**
   * Sets the values of the updated columns.
   * @param qb The query builder to set the values into.
   * @param obj The object of column-value pairs to be updated.
   */
  protected setColumnValues(
    qb: UpdateQueryBuilder<DB, TB, TB, UpdateResult>,
    obj: Updateable<DB[TB]>
  ): UpdateQueryBuilder<DB, TB, TB, UpdateResult> {
    return qb.set(obj);
  }
}
