import {
  Kysely,
  Insertable,
  ReferenceExpression,
  Selectable,
  Updateable,
  InsertQueryBuilder,
  InsertResult,
  SelectQueryBuilder,
  Selection,
  DeleteQueryBuilder,
  DeleteResult,
  UpdateResult,
  UpdateQueryBuilder,
} from 'kysely';

import { QueryFilter, applyQueryFilter } from '../lib/query-filter';
import {
  ObjectWithKeys,
  SelectedRow,
  SelectionColumn,
} from '../lib/type-utils';
import { TableMapperOptions } from './table-mapper-options';
import { MappingDeleteQuery } from '../queries/delete-query';
import { RowConverter } from '../lib/row-converter';
import { MappingSelectQuery } from '../queries/select-query';
import { AllSelection } from '../lib/kysely-types';
import { MappingInsertQuery } from '../queries/insert-query';

// TODO: change [binary op] notation to three parameters

/**
 * A mapper providing access to a single table.
 * @typeparam DB Interface whose fields are table names defining tables.
 * @typeparam TB Name of the table.
 * @typeparam SelectedObject Type of objects returned by select queries.
 * @typeparam InsertedObject Type of objects inserted into the table.
 * @typeparam UpdaterObject Type of objects used to update rows of the table.
 * @typeparam ReturnedCount Type of count query results.
 * @typeparam ReturnColumns Columns to return from the table on insert or
 *  update, except when explicitly requesting no columns. `['*']` returns
 *  all columns; `[]` returns none and is the default.
 * @typeparam ReturnedObject Objects to return from inserts and updates.
 */
export class TableMapper<
  DB,
  TB extends keyof DB & string,
  SelectedColumns extends SelectionColumn<DB, TB>[] | ['*'] = ['*'],
  SelectedObject extends object = SelectedRow<
    DB,
    TB,
    SelectedColumns extends ['*'] ? never : SelectedColumns[number],
    SelectedColumns
  >,
  InsertedObject extends object = Insertable<DB[TB]>,
  UpdaterObject extends object = Partial<Insertable<DB[TB]>>,
  // TODO: support aliases in ReturnColumns and test
  ReturnColumns extends (keyof Selectable<DB[TB]> & string)[] | ['*'] = [],
  ReturnedCount = bigint,
  ReturnedObject extends object = ReturnColumns extends ['*']
    ? Selectable<DB[TB]>
    : ObjectWithKeys<Selectable<DB[TB]>, ReturnColumns>
> {
  #baseDeleteQB: DeleteQueryBuilder<DB, TB, DeleteResult> | null = null;
  #baseInsertQB: InsertQueryBuilder<DB, TB, InsertResult> | null = null;
  #baseSelectQB: SelectQueryBuilder<DB, TB, object> | null = null;
  #baseUpdateQB: UpdateQueryBuilder<DB, TB, TB, UpdateResult> | null = null;

  /** Columns to return from selection queries. `[]` => all columns. */
  protected readonly selectedColumns: SelectionColumn<DB, TB>[];

  /** Columns to return from the table on insert or update. */
  protected returnColumns: (keyof Selectable<DB[TB]> & string)[] | ['*'];

  /** Converts retrieved rows to `SelectedObject`. */
  protected readonly rowConverter: RowConverter;

  /** Transforms query counts into `ReturnedCount`. */
  protected countTransform: (count: bigint) => ReturnedCount = (count) =>
    count as any;

  /**
   * Constructs a new table mapper.
   * @param db The Kysely database.
   * @param tableName The name of the table.
   * @param options Options governing mapper behavior. `returnColumns`
   *  defaults to returning no columns.
   */
  constructor(
    readonly db: Kysely<DB>,
    readonly tableName: TB,
    readonly options: TableMapperOptions<
      DB,
      TB,
      SelectedColumns,
      SelectedObject,
      InsertedObject,
      UpdaterObject,
      ReturnColumns,
      ReturnedCount,
      ReturnedObject
    > = {}
  ) {
    this.returnColumns = options.returnColumns ?? [];

    this.selectedColumns =
      options.selectedColumns === undefined
        ? ([] as any)
        : options.selectedColumns.includes('*' as any)
        ? ([] as any)
        : options.selectedColumns;
    this.rowConverter = new RowConverter(options.selectTransform);

    if (options.insertTransform) {
      this.transformInsertion = options.insertTransform;
    }
    if (options.updaterTransform) {
      this.transformUpdater = options.updaterTransform;
    }
    if (options.insertReturnTransform) {
      this.transformInsertReturn = options.insertReturnTransform;
    }
    if (options.countTransform) {
      this.countTransform = options.countTransform;
    }
  }

  /**
   * Creates and returns a parameterized mapping query, which can be repeatedly
   * executed with different parameter values, but which only ever compiles
   * the underlying Kysely query once (on the first execution).
   * @paramtype P Record characterizing the available parameter names and types.
   * @param factory Function that receives an object of the form `{ q, param }`,
   *  where `q` is a mapping query and `param` is a function for creating
   *  parameters. The argument to `param` is the name of the parameter, which
   *  must occur as a property of `P`. You may parameterize inserted values,
   *  updated values, and right-hand-side values of filters. Parameters may not
   *  be arrays, but you can parameterize the individual elements of an array.
   *  Returns a mapping query that containing the parameterized values.
   * @returns a parameterized mapping query
   */
  // compile<P extends ParametersObject<P>>(
  //   factory: ParamedSelectionQueryFactory<
  //     P,
  //     MappingSelectQuery<DB, TB, SelectedObject, QB>
  //   >
  // ): ParameterizedRowQuery<P, SelectedObject> {
  //   const parameterMaker = new QueryParameterMaker<P>();
  //   return new ParameterizedRowQuery(
  //     factory({
  //       q: this,
  //       param: parameterMaker.param.bind(parameterMaker),
  //     }).qb,
  //     this.rowConverter
  //   );
  // }
  /**
   * Factory function for parameterizing MappingSelectQuery.
   */
  // interface ParamedSelectionQueryFactory<
  //   P extends ParametersObject<P>,
  //   Q extends MappingSelectQuery<any, any, any, any>
  // > {
  //   (args: { q: Q; param: QueryParameterMaker<P>['param'] }): Q;
  // }

  /**
   * Returns a mapping query for deleting rows from the table.
   * @param filter Optional filter for selecting rows to delete.
   * @returns A mapping query for deleting rows.
   */
  delete<
    RE extends ReferenceExpression<DB, TB>,
    QB extends DeleteQueryBuilder<DB, TB, DeleteResult>
  >(
    filter?: QueryFilter<
      DB,
      TB,
      RE,
      DeleteQueryBuilder<DB, any, DeleteResult>,
      QB
    >
  ): MappingDeleteQuery<
    DB,
    TB,
    DeleteQueryBuilder<DB, TB, DeleteResult>,
    ReturnedCount
  > {
    return new MappingDeleteQuery(
      this.db,
      filter === undefined
        ? this.getDeleteQB()
        : applyQueryFilter(this.db, this.getDeleteQB(), filter),
      this.countTransform
    );
  }

  // TODO: support listing inserted columns
  /**
   * Returns a query for inserting rows into the table.
   * @returns A mapping query for inserting rows.
   */
  insert(): MappingInsertQuery<
    DB,
    TB,
    InsertQueryBuilder<DB, TB, InsertResult>,
    InsertedObject,
    ReturnColumns,
    ReturnedObject
  > {
    return new MappingInsertQuery(
      this.db,
      this.getInsertQB(),
      this.options.insertTransform,
      this.options.returnColumns,
      this.options.insertReturnTransform
    );
  }

  /**
   * Returns a reference to a column, which can be a generated string.
   * @param column The column name being referenced.
   * @returns A reference to the given column.
   */
  ref(column: string) {
    return this.db.dynamic.ref(column);
  }

  /**
   * Returns a mapping query for selecting rows from the table.
   * @param filter Optional filter to apply to the query.
   * @returns A mapping query for retrieving rows as objects.
   */
  select<
    RE extends ReferenceExpression<DB, TB>,
    QB extends SelectQueryBuilder<DB, TB, object>
  >(
    filter?: QueryFilter<DB, TB, RE, SelectQueryBuilder<DB, TB, object>, QB>
  ): MappingSelectQuery<
    DB,
    TB,
    SelectedObject,
    SelectQueryBuilder<DB, TB, object>
  > {
    return new MappingSelectQuery(
      this.db,
      filter === undefined
        ? this.getSelectQB()
        : applyQueryFilter(this.db, this.getSelectQB(), filter),
      this.rowConverter
    );
  }

  /**
   * Updates rows in this table matching the provided filter, returning
   * the number of updated rows.
   * @param filter Filter specifying the rows to update.
   * @param obj The object whose field values are to be assigned to the row.
   * @returns Returns the number of updated rows.
   * @see this.updateWhere
   */
  async updateCount<
    RE extends ReferenceExpression<DB, TB>,
    QB extends UpdateQueryBuilder<DB, TB, TB, UpdateResult>
  >(
    filter: QueryFilter<
      DB,
      TB,
      RE,
      UpdateQueryBuilder<DB, TB, TB, UpdateResult>,
      QB
    >,
    obj: UpdaterObject
  ): Promise<number> {
    const transformedObj = this.transformUpdater(obj);
    const uqb = this.getUpdateQB().set(transformedObj as any);
    const fqb = applyQueryFilter(this.db, uqb, filter);
    const result = await fqb.executeTakeFirst();
    return Number(result.numUpdatedRows);
  }

  /**
   * Updates rows in this table matching the provided filter. For each row
   * updated, retrieves the columns specified in the `returnColumns` option,
   * which are returned unless `updateReturnTransform` transforms them
   * into `ReturnedObject`. If `returnColumns` is empty, returns nothing.
   * @param filter Filter specifying the rows to update.
   * @param obj The object whose field values are to be assigned to the row.
   * @returns Returns an array of `ReturnedObject` objects, one for each
   *  updated row, or nothing (void) if `returnColumns` is empty.
   * @see this.updateCount
   */
  updateWhere<
    RE extends ReferenceExpression<DB, TB>,
    QB extends UpdateQueryBuilder<DB, TB, TB, UpdateResult>
  >(
    filter: QueryFilter<
      DB,
      TB,
      RE,
      UpdateQueryBuilder<DB, TB, TB, UpdateResult>,
      QB
    >,
    obj: UpdaterObject
  ): Promise<ReturnColumns extends [] ? void : ReturnedObject[]>;

  async updateWhere<
    RE extends ReferenceExpression<DB, TB>,
    QB extends UpdateQueryBuilder<DB, TB, TB, UpdateResult>
  >(
    filter: QueryFilter<
      DB,
      TB,
      RE,
      UpdateQueryBuilder<DB, TB, TB, UpdateResult>,
      QB
    >,
    obj: UpdaterObject
  ): Promise<ReturnedObject[] | void> {
    const transformedObj = this.transformUpdater(obj);
    const uqb = this.getUpdateQB().set(transformedObj as any);
    const fqb = applyQueryFilter(this.db, uqb, filter);

    if (this.returnColumns.length == 0) {
      await fqb.execute();
      return;
    }

    // Assign `returns` all at once to capture its complex type. Can't place
    // this in a shared method because the types are not compatible.
    const returns =
      this.returnColumns[0] == '*'
        ? await fqb.returningAll().execute()
        : await fqb.returning(this.returnColumns as any).execute();
    if (returns === undefined) {
      throw Error('No rows returned from update expecting returned columns');
    }
    return this.transformUpdateReturn(obj, returns as any) as any;
  }

  /**
   * Returns a query builder for deleting rows from the table, caching the
   * query builder for use with future deletions.
   * @returns A query builder for deleting rows from the table.
   */
  protected getDeleteQB(): DeleteQueryBuilder<DB, TB, DeleteResult> {
    if (this.#baseDeleteQB === null) {
      this.#baseDeleteQB = this.db.deleteFrom(
        this.tableName
      ) as DeleteQueryBuilder<DB, TB, DeleteResult>;
    }
    return this.#baseDeleteQB;
  }

  /**
   * Returns a query builder for inserting rows into the table, caching the
   * query builder for use with future insertions.
   * @returns A query builder for inserting rows into the table.
   */
  protected getInsertQB(): InsertQueryBuilder<DB, TB, InsertResult> {
    if (this.#baseInsertQB === null) {
      this.#baseInsertQB = this.db.insertInto(
        this.tableName
      ) as InsertQueryBuilder<DB, TB, InsertResult>;
    }
    return this.#baseInsertQB;
  }

  /**
   * Returns a query builder for selecting rows from the table, caching the
   * query builder for use with future selection. The query builder returns
   * the columns and aliases specified in `SelectedColumns`.
   * @returns A query builder for selecting rows from the table.
   */
  protected getSelectQB():
    | SelectQueryBuilder<DB, TB, object & AllSelection<DB, TB>>
    | (SelectedColumns extends ['*']
        ? never
        : SelectQueryBuilder<
            DB,
            TB,
            object & Selection<DB, TB, SelectedColumns[number]>
          >);

  protected getSelectQB(): SelectQueryBuilder<DB, TB, object> {
    if (this.#baseSelectQB === null) {
      const selectQB = this.db.selectFrom(this.tableName) as SelectQueryBuilder<
        DB,
        TB,
        object
      >;
      this.#baseSelectQB =
        this.selectedColumns.length == 0
          ? selectQB.selectAll()
          : selectQB.select(this.selectedColumns);
    }
    return this.#baseSelectQB;
  }

  /**
   * Returns a query builder for updating rows from the table, caching the
   * query builder for use with future updates.
   * @returns A query builder for updating rows from the table.
   */
  protected getUpdateQB(): UpdateQueryBuilder<DB, TB, TB, UpdateResult> {
    if (this.#baseUpdateQB === null) {
      this.#baseUpdateQB = this.db.updateTable(this.tableName) as any;
    }
    return this.#baseUpdateQB!;
  }

  /**
   * Transforms an object into a row for insertion.
   * @param obj The object to transform.
   * @returns Row representation of the object.
   */
  // This lengthy type provides better type assistance messages
  // in VSCode than a dedicated TransformInsertion type would.
  protected transformInsertion: NonNullable<
    TableMapperOptions<
      DB,
      TB,
      SelectedColumns,
      SelectedObject,
      InsertedObject,
      UpdaterObject,
      ReturnColumns,
      ReturnedCount,
      ReturnedObject
    >['insertTransform']
  > = (obj) => obj as Insertable<DB[TB]>;

  /**
   * Transforms an array of to-be-inserted objects into an insertable array
   * of rows. A utility for keeping transform code simple and performant.
   * @param source The array of inseted objects to transform.
   * @returns Array of rows representing the objects.
   */
  protected transformInsertionArray(
    source: InsertedObject[]
  ): Insertable<DB[TB]>[] {
    if (this.options.insertTransform) {
      // TS isn't seeing that that transform is defined.
      return source.map((obj) => this.options.insertTransform!(obj));
    }
    return source as any;
  }

  /**
   * Transforms an object returned from an insert into an object to be
   * returned to the caller.
   * @param source The object that was inserted.
   * @param returns The object returned from the insert.
   * @returns The object to be returned to the caller.
   */
  // This lengthy type provides better type assistance messages
  // in VSCode than a dedicated TransformInsertion type would.
  protected transformInsertReturn: NonNullable<
    TableMapperOptions<
      DB,
      TB,
      SelectedColumns,
      SelectedObject,
      InsertedObject,
      UpdaterObject,
      ReturnColumns,
      ReturnedCount,
      ReturnedObject
    >['insertReturnTransform']
  > = (_obj, ret) => ret as any;

  /**
   * Transforms an array of objects returned from an insert into an array
   * of objects to be returned to the caller.
   * @param source The array of objects that were inserted.
   * @param returns The array of objects returned from the insert.
   * @returns Array of objects to be returned to the caller.
   */
  protected transformInsertReturnArray(
    source: InsertedObject[],
    returns: ObjectWithKeys<Selectable<DB[TB]>, ReturnColumns>[]
  ): ReturnedObject[] {
    if (this.options.insertReturnTransform) {
      return source.map((obj, i) =>
        // TS isn't seeing that that transform is defined.
        this.options.insertReturnTransform!(obj, returns[i])
      );
    }
    return returns as any;
  }

  /**
   * Transforms an object into a row for insertion.
   * @param obj The object to transform.
   * @returns Row representation of the object.
   */
  // This lengthy type provides better type assistance messages
  // in VSCode than a dedicated TransformInsertion type would.
  protected transformUpdater: NonNullable<
    TableMapperOptions<
      DB,
      TB,
      SelectedColumns,
      SelectedObject,
      InsertedObject,
      UpdaterObject,
      ReturnColumns,
      ReturnedCount,
      ReturnedObject
    >['updaterTransform']
  > = (obj) => obj as Updateable<DB[TB]>;

  /**
   * Transforms an array of objects returned from an update
   * into objects to be returned to the caller.
   * @param source The object that provided the update values.
   * @param returns The array of objects returned from the update.
   * @returns Array of objects to be returned to the caller.
   */
  protected transformUpdateReturn(
    source: UpdaterObject,
    returns: ObjectWithKeys<Selectable<DB[TB]>, ReturnColumns>[]
  ): ReturnedObject[] {
    if (this.options.updateReturnTransform) {
      return returns.map((returnValues) =>
        // TS isn't seeing that that transform is defined.
        this.options.updateReturnTransform!(source, returnValues)
      );
    }
    return returns as any;
  }
}
