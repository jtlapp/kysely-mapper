import { Kysely, SelectQueryBuilder } from 'kysely';
import { SelectedRow, SelectionColumn } from '../lib/type-utils';

/**
 * Mapping query for selecting rows from a database table.
 */
export class MappingSelectQuery<
  DB,
  TB extends keyof DB & string,
  SelectedColumns extends SelectionColumn<DB, TB>[] | ['*'],
  SelectedObject extends object,
  QB extends SelectQueryBuilder<DB, TB, any>
> {
  /**
   * @param db Kysely database instance.
   * @param qb Kysely select query builder.
   * @param selectTransform A function that transforms a selected row
   *  into an object to be returned from the select query.
   */
  constructor(
    readonly db: Kysely<DB>,
    readonly qb: QB,
    protected readonly selectTransform?: (
      row: SelectedRow<
        DB,
        TB,
        SelectedColumns extends ['*'] ? never : SelectedColumns[number],
        SelectedColumns
      >
    ) => SelectedObject
  ) {}

  /**
   * Retrieves zero or more rows from the table, using `selectTransform`
   * (if provided) to map the rows to objects of type `SelectedObject`.
   * @returns An array of objects for the selected rows, possibly empty.
   */
  async getMany(): Promise<SelectedObject[]> {
    const results = await this.qb.execute();
    return this.selectTransform === undefined
      ? results
      : (results as any[]).map(this.selectTransform);
  }

  /**
   * Retrieves a single row from the table, using `selectTransform`
   * (if provided) to map the row to an object of type `SelectedObject`.
   * @returns An object for the selected rows, or null if not found.
   */
  async getOne(): Promise<SelectedObject | null> {
    const result = await this.qb.executeTakeFirst();
    if (!result) return null;
    return this.selectTransform === undefined
      ? result
      : this.selectTransform(result);
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
    return new MappingSelectQuery(
      this.db,
      factory(this.qb),
      this.selectTransform
    );
  }
}
