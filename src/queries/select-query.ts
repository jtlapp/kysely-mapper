import { Kysely, SelectQueryBuilder } from 'kysely';
import { SelectionColumn } from '../lib/type-utils';
import { ParameterizableMappingQuery } from './paramable-query';
import { ParametersObject } from 'kysely-params';
import { CompilingMappingSelectQuery } from './compiling-select-query';
import { SelectTransform } from '../mappers/table-mapper-transforms';

/**
 * Mapping query for selecting rows from a database table.
 */
export class MappingSelectQuery<
  DB,
  TB extends keyof DB & string,
  SelectedColumns extends Readonly<SelectionColumn<DB, TB>[]> | ['*'],
  SelectedObject extends object,
  QB extends SelectQueryBuilder<DB, TB, any>
> implements ParameterizableMappingQuery
{
  /**
   * @param db Kysely database instance.
   * @param qb Kysely select query builder.
   * @param selectTransform A function that transforms a selected row
   *  into an object to be returned from the select query.
   */
  constructor(
    readonly db: Kysely<DB>,
    readonly qb: QB,
    protected readonly transforms: Readonly<
      SelectTransform<DB, TB, SelectedColumns, SelectedObject>
    >
  ) {}

  /**
   * Returns a compiling query that can be executed multiple times with
   * different parameters (if any parameters were provided), but which only
   * compiles the underlying Kysely query builder on the first execution.
   * Frees the query builder on the first execution to reduce memory usage.
   * @typeparam P Record characterizing the parameter names and types
   *  that were previously embedded in the query, if any.
   * @returns A compiling select query.
   */
  compile<P extends ParametersObject<P> = {}>(): CompilingMappingSelectQuery<
    DB,
    TB,
    SelectedColumns,
    SelectedObject,
    SelectQueryBuilder<DB, TB, P>,
    P
  > {
    return new CompilingMappingSelectQuery(this.db, this.qb, this.transforms);
  }

  /**
   * Modifies the underlying Kysely query builder. All columns given in
   * `SelectedColumns` are already selected, but you can select additional
   * columns or add column aliases.
   * @param factory A function that takes the current query builder and
   *  returns a new query builder.
   */
  modify<NextQB extends SelectQueryBuilder<DB, TB, any>>(
    factory: (qb: QB) => NextQB
  ): MappingSelectQuery<DB, TB, SelectedColumns, SelectedObject, NextQB> {
    return new MappingSelectQuery(this.db, factory(this.qb), this.transforms);
  }

  /**
   * Retrieves zero or more rows from the table, using `selectTransform`
   * (if provided) to map the rows to objects of type `SelectedObject`.
   * @returns An array of objects for the selected rows, possibly empty.
   */
  async returnAll(): Promise<SelectedObject[]> {
    const results = await this.qb.execute();
    return this.transforms.selectTransform === undefined
      ? results
      : (results as any[]).map(this.transforms.selectTransform);
  }

  /**
   * Retrieves a single row from the table, using `selectTransform`
   * (if provided) to map the row to an object of type `SelectedObject`.
   * @returns An object for the selected rows, or null if not found.
   */
  async returnOne(): Promise<SelectedObject | null> {
    const result = await this.qb.executeTakeFirst();
    if (!result) return null;
    return this.transforms.selectTransform === undefined
      ? result
      : this.transforms.selectTransform(result);
  }
}
