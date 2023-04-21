import {
  Kysely,
  Insertable,
  ReferenceExpression,
  Selectable,
  InsertQueryBuilder,
  InsertResult,
  SelectQueryBuilder,
  Selection,
  DeleteQueryBuilder,
  DeleteResult,
  UpdateResult,
  UpdateQueryBuilder,
  ComparisonOperatorExpression,
  OperandValueExpressionOrList,
  Updateable,
} from 'kysely';

import { QueryFilter } from '../lib/query-filter';
import { applyQueryFilter } from '../lib/apply-query-filter';
import {
  SelectableColumnTuple,
  SelectedRow,
  SelectionColumn,
} from '../lib/type-utils';
import { MappingDeleteQuery } from '../queries/delete-query';
import { MappingSelectQuery } from '../queries/select-query';
import { MappingUpdateQuery } from '../queries/update-query';
import { AnyColumnsMappingInsertQuery } from '../queries/any-insert-query';
import { AnyColumnsMappingUpdateQuery } from '../queries/any-update-query';
import { ParametersObject, QueryParameterMaker } from 'kysely-params';
import { ParameterizableMappingQueryFactory } from '../lib/parameterizable-query-factory';
import { CompilingMappingSelectQuery } from '../queries/compiling-select-query';
import { CompilingMappingDeleteQuery } from '../queries/compiling-delete-query';
import { SubsettingMappingUpdateQuery } from '../queries/subsetting-update-query';
import { CompilingMappingUpdateQuery } from '../queries/compiling-update-query';
import { TableMapperSettings } from './table-mapper-settings';
import { TableMapperTransforms } from './table-mapper-transforms';

/**
 * Abstract base class for table mappers. It is abstract because it does not
 * provide a way to specify query input and output transforms. Custom table
 * mappers should extend this class with means for providing transforms.
 * @typeparam DB Interface whose fields are table names defining tables.
 * @typeparam TB Name of the table.
 * @typeparam KeyColumns Tuple of the names of the table's key columns.
 *  Defaults to `[]`, indicating no key columns. Supports up to 4 columns.
 * @typeparam SelectedColumns Columns to return from selection queries.
 *  Defaults to `['*']`, returning all columns. May specify aliases.
 * @typeparam SelectedObject Type of objects returned by select queries.
 * @typeparam InsertedObject Type of objects inserted into the table.
 * @typeparam UpdatingObject Type of objects used to update rows of the table.
 * @typeparam ReturnCount Type of the count of the number of affected rows.
 * @typeparam InsertReturnColumns Columns to return from the table on insert
 *  queries that return columns. `['*']` returns all columns; `[]` returns
 *  none. May specify aliases. Defaults to `KeyColumns`.
 * @typeparam UpdateReturnColumns Columns to return from the table on update
 *  queries that return columns. `['*']` returns all columns; `[]` returns
 *  none and is the default. May specify aliases.
 * @typeparam InsertReturn Type returned from inserts. Defaults to an object
 *  whose properties are the columns of `InsertReturnColumns`.
 * @typeparam UpdateReturn Type returned from updates. Defaults to an object
 *  whose properties are the columns of `UpdateReturnColumns`.
 */
export abstract class AbstractTableMapper<
  DB,
  TB extends keyof DB & string,
  KeyColumns extends
    | Readonly<SelectableColumnTuple<DB[TB]>>
    | Readonly<[]> = [],
  SelectedColumns extends Readonly<SelectionColumn<DB, TB>[]> | ['*'] = ['*'],
  SelectedObject = SelectedRow<
    DB,
    TB,
    SelectedColumns extends ['*'] ? never : SelectedColumns[number],
    SelectedColumns
  >,
  InsertedObject = Insertable<DB[TB]>,
  UpdatingObject = Updateable<DB[TB]>,
  ReturnCount = bigint,
  InsertReturnColumns extends
    | Readonly<SelectionColumn<DB, TB>[]>
    | ['*'] = Readonly<KeyColumns>,
  UpdateReturnColumns extends Readonly<SelectionColumn<DB, TB>[]> | ['*'] = [],
  InsertReturn = InsertReturnColumns extends ['*']
    ? Selectable<DB[TB]>
    : Selection<DB, TB, InsertReturnColumns[number]>,
  UpdateReturn = UpdateReturnColumns extends ['*']
    ? Selectable<DB[TB]>
    : Selection<DB, TB, UpdateReturnColumns[number]>
> {
  #baseDeleteQB: DeleteQueryBuilder<DB, TB, DeleteResult> | null = null;
  #baseInsertQB: InsertQueryBuilder<DB, TB, InsertResult> | null = null;
  #baseSelectQB: SelectQueryBuilder<DB, TB, object> | null = null;
  #baseUpdateQB: UpdateQueryBuilder<DB, TB, TB, UpdateResult> | null = null;

  /** Columns that compose the table's primary key. */
  protected readonly keyColumns: KeyColumns;

  /** Columns to return from selection queries. `[]` => all columns. */
  protected readonly selectedColumns: SelectionColumn<DB, TB>[];

  /** Columns to return from the table on insert. */
  protected readonly insertReturnColumns:
    | Readonly<SelectionColumn<DB, TB>[]>
    | ['*'];

  /** Columns to return from the table on update. */
  protected readonly updateReturnColumns:
    | Readonly<SelectionColumn<DB, TB>[]>
    | ['*'];

  /** Query input and output value transforms. */
  protected transforms: TableMapperTransforms<
    DB,
    TB,
    KeyColumns,
    SelectedColumns,
    SelectedObject,
    InsertedObject,
    UpdatingObject,
    ReturnCount,
    InsertReturnColumns,
    UpdateReturnColumns,
    InsertReturn,
    UpdateReturn
  > = {};

  /**
   * Constructs a new abstract table mapper.
   * @param db The Kysely database.
   * @param tableName The name of the table.
   * @param options Options governing mapper behavior. Default to selecting
   *  all columns and to returning no columns on insert or update.
   */
  constructor(
    readonly db: Kysely<DB>,
    readonly tableName: TB,
    readonly settings: Readonly<
      TableMapperSettings<
        DB,
        TB,
        KeyColumns,
        SelectedColumns,
        InsertReturnColumns,
        UpdateReturnColumns
      >
    > = {}
  ) {
    this.keyColumns = settings.keyColumns ?? ([] as any);

    this.selectedColumns =
      settings.selectedColumns === undefined
        ? ([] as any)
        : settings.selectedColumns.includes('*' as any)
        ? ([] as any)
        : settings.selectedColumns;

    this.insertReturnColumns =
      settings.insertReturnColumns ?? this.keyColumns ?? ([] as any);

    this.updateReturnColumns = settings.updateReturnColumns ?? ([] as any);
  }

  /**
   * Returns a mapping query for deleting the rows of the table that match
   * the provided filter or Kysely binary operation.
   * @param filter Optional filter to apply to the query or the left-hand-side
   *  of a Kysely binary operation.
   * @returns A mapping query for deleting rows.
   */
  delete<RE extends ReferenceExpression<DB, TB>>(
    lhs: RE,
    op: ComparisonOperatorExpression,
    rhs: OperandValueExpressionOrList<DB, TB, RE>
  ): MappingDeleteQuery<
    DB,
    TB,
    DeleteQueryBuilder<DB, TB, DeleteResult>,
    ReturnCount
  >;

  delete<RE extends ReferenceExpression<DB, TB>>(
    filter?: QueryFilter<DB, TB, KeyColumns, RE>
  ): MappingDeleteQuery<
    DB,
    TB,
    DeleteQueryBuilder<DB, TB, DeleteResult>,
    ReturnCount
  >;

  delete<RE extends ReferenceExpression<DB, TB>>(
    filterOrLHS?: QueryFilter<DB, TB, KeyColumns, RE> | RE,
    op?: ComparisonOperatorExpression,
    rhs?: OperandValueExpressionOrList<DB, TB, RE>
  ): MappingDeleteQuery<
    DB,
    TB,
    DeleteQueryBuilder<DB, TB, DeleteResult>,
    ReturnCount
  > {
    return new MappingDeleteQuery(
      this.db,
      filterOrLHS === undefined
        ? this.getDeleteQB()
        : applyQueryFilter(
            this.db,
            this.getDeleteQB(),
            this.keyColumns,
            filterOrLHS,
            op,
            rhs
          ),
      this.transforms
    );
  }

  /**
   * Returns a query for inserting rows into the table.
   * @returns A mapping query for inserting rows.
   */
  insert(): AnyColumnsMappingInsertQuery<
    DB,
    TB,
    InsertQueryBuilder<DB, TB, InsertResult>,
    InsertedObject,
    InsertReturnColumns,
    InsertReturn
  > {
    return new AnyColumnsMappingInsertQuery(
      this.db,
      this.getInsertQB(),
      this.transforms,
      this.insertReturnColumns as InsertReturnColumns
    );
  }

  /**
   * Creates and returns a parameterized mapping query, which can be repeatedly
   * executed with different parameter values, but which only ever compiles
   * the underlying Kysely query once (on the first execution).
   * @paramtype Parameters Record characterizing the available parameter names
   *  and types.
   * @param factory Function that receives an object of the form `{ mapper,
   *  param }`, where `mapper` is the present table mapper and `param` is a
   *  function for creating parameters. The argument to `param` is the name of
   *  the parameter, which must occur as a property of `Parameters`. You may
   *  parameterize inserted values, updated values, and right-hand-side values
   *  of filters. Parameters may not be arrays, but you can parameterize the
   *  individual elements of an array. Returns a parameterized mapping query.
   * @returns A parameterized mapping query
   */
  parameterize<Parameters extends ParametersObject<Parameters>>(
    factory: ParameterizableMappingQueryFactory<
      DB,
      TB,
      KeyColumns,
      SelectedColumns,
      SelectedObject,
      InsertedObject,
      UpdatingObject,
      ReturnCount,
      InsertReturnColumns,
      UpdateReturnColumns,
      InsertReturn,
      UpdateReturn,
      this,
      Parameters,
      MappingDeleteQuery<
        DB,
        TB,
        DeleteQueryBuilder<DB, TB, DeleteResult>,
        ReturnCount
      >
    >
  ): CompilingMappingDeleteQuery<
    DB,
    TB,
    DeleteQueryBuilder<DB, TB, DeleteResult>,
    ReturnCount,
    Parameters
  >;

  parameterize<Parameters extends ParametersObject<Parameters>>(
    factory: ParameterizableMappingQueryFactory<
      DB,
      TB,
      KeyColumns,
      SelectedColumns,
      SelectedObject,
      InsertedObject,
      UpdatingObject,
      ReturnCount,
      InsertReturnColumns,
      UpdateReturnColumns,
      InsertReturn,
      UpdateReturn,
      this,
      Parameters,
      MappingSelectQuery<
        DB,
        TB,
        SelectedColumns,
        SelectedObject,
        SelectQueryBuilder<DB, TB, object>
      >
    >
  ): CompilingMappingSelectQuery<
    DB,
    TB,
    SelectedColumns,
    SelectedObject,
    SelectQueryBuilder<DB, TB, object>,
    Parameters
  >;

  parameterize<Parameters extends ParametersObject<Parameters>>(
    factory: ParameterizableMappingQueryFactory<
      DB,
      TB,
      KeyColumns,
      SelectedColumns,
      SelectedObject,
      InsertedObject,
      UpdatingObject,
      ReturnCount,
      InsertReturnColumns,
      UpdateReturnColumns,
      InsertReturn,
      UpdateReturn,
      this,
      Parameters,
      SubsettingMappingUpdateQuery<
        DB,
        TB,
        UpdateQueryBuilder<DB, TB, TB, UpdateResult>,
        UpdatingObject,
        UpdateReturnColumns,
        ReturnCount,
        UpdateReturn
      >
    >
  ): CompilingMappingUpdateQuery<
    DB,
    TB,
    UpdateQueryBuilder<DB, TB, TB, UpdateResult>,
    UpdatingObject,
    UpdateReturnColumns,
    ReturnCount,
    UpdateReturn,
    Parameters
  >;

  parameterize<Parameters extends ParametersObject<Parameters>>(
    factory: ParameterizableMappingQueryFactory<
      DB,
      TB,
      KeyColumns,
      SelectedColumns,
      SelectedObject,
      InsertedObject,
      UpdatingObject,
      ReturnCount,
      InsertReturnColumns,
      UpdateReturnColumns,
      InsertReturn,
      UpdateReturn,
      this,
      Parameters,
      any
    >
  ): any {
    const parameterMaker = new QueryParameterMaker<Parameters>();
    return factory({
      mapper: this,
      param: parameterMaker.param.bind(parameterMaker),
    }).compile();
  }

  /**
   * Returns a reference to a column, which can be a generated string.
   * (Shorthand for `db.dynamic.ref(column)`.)
   * @param column The column name being referenced.
   * @returns A reference to the given column.
   */
  ref(column: string) {
    return this.db.dynamic.ref(column);
  }

  /**
   * Returns a mapping query for selecting rows of the table that match
   *  the provided filter or Kysely binary operation.
   * @param filter Optional filter to apply to the query or the left-hand-side
   *  of a Kysely binary operation.
   * @returns A mapping query for retrieving rows as objects.
   */
  select<RE extends ReferenceExpression<DB, TB>>(
    lhs: RE,
    op: ComparisonOperatorExpression,
    rhs: OperandValueExpressionOrList<DB, TB, RE>
  ): MappingSelectQuery<
    DB,
    TB,
    SelectedColumns,
    SelectedObject,
    SelectQueryBuilder<DB, TB, object>
  >;

  select<RE extends ReferenceExpression<DB, TB>>(
    filter?: QueryFilter<DB, TB, KeyColumns, RE>
  ): MappingSelectQuery<
    DB,
    TB,
    SelectedColumns,
    SelectedObject,
    SelectQueryBuilder<DB, TB, object>
  >;

  select<RE extends ReferenceExpression<DB, TB>>(
    filterOrLHS?: QueryFilter<DB, TB, KeyColumns, RE> | RE,
    op?: ComparisonOperatorExpression,
    rhs?: OperandValueExpressionOrList<DB, TB, RE>
  ): MappingSelectQuery<
    DB,
    TB,
    SelectedColumns,
    SelectedObject,
    SelectQueryBuilder<DB, TB, object>
  > {
    return new MappingSelectQuery(
      this.db,
      filterOrLHS === undefined
        ? this.getSelectQB()
        : applyQueryFilter(
            this.db,
            this.getSelectQB(),
            this.keyColumns,
            filterOrLHS,
            op,
            rhs
          ),
      this.transforms
    );
  }

  /**
   * Returns a mapping query for updating rows of the table that match
   *  the provided filter or Kysely binary operation.
   * @param filter Optional filter to apply to the query or the left-hand-side
   *  of a Kysely binary operation.
   * @returns A mapping query for updating table rows.
   */
  update<RE extends ReferenceExpression<DB, TB>>(
    lhs: RE,
    op: ComparisonOperatorExpression,
    rhs: OperandValueExpressionOrList<DB, TB, RE>
  ): AnyColumnsMappingUpdateQuery<
    DB,
    TB,
    UpdateQueryBuilder<DB, TB, TB, UpdateResult>,
    UpdatingObject,
    UpdateReturnColumns,
    ReturnCount,
    UpdateReturn
  >;

  update<RE extends ReferenceExpression<DB, TB>>(
    filter?: QueryFilter<DB, TB, KeyColumns, RE>
  ): AnyColumnsMappingUpdateQuery<
    DB,
    TB,
    UpdateQueryBuilder<DB, TB, TB, UpdateResult>,
    UpdatingObject,
    UpdateReturnColumns,
    ReturnCount,
    UpdateReturn
  >;

  update<RE extends ReferenceExpression<DB, TB>>(
    filterOrLHS?: QueryFilter<DB, TB, KeyColumns, RE> | RE,
    op?: ComparisonOperatorExpression,
    rhs?: OperandValueExpressionOrList<DB, TB, RE>
  ): MappingUpdateQuery<
    DB,
    TB,
    UpdateQueryBuilder<DB, TB, TB, UpdateResult>,
    UpdatingObject,
    UpdateReturnColumns,
    ReturnCount,
    UpdateReturn
  > {
    return new AnyColumnsMappingUpdateQuery(
      this.db,
      filterOrLHS === undefined
        ? this.getUpdateQB()
        : applyQueryFilter(
            this.db,
            this.getUpdateQB(),
            this.keyColumns,
            filterOrLHS,
            op,
            rhs
          ),
      this.transforms,
      this.updateReturnColumns as UpdateReturnColumns
    );
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
  protected getSelectQB(): SelectedColumns extends ['*']
    ? never
    : SelectQueryBuilder<
        DB,
        TB,
        object & Selection<DB, TB, SelectedColumns[number]>
      >;

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
}
