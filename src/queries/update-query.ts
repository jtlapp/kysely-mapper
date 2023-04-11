import { Kysely, UpdateQueryBuilder, UpdateResult } from 'kysely';

import { RowConverter } from '../lib/row-converter';

/**
 * Mapper query for updating rows from a database table.
 */
export class UpdateQuery<
  DB,
  TB extends keyof DB & string,
  QB extends UpdateQueryBuilder<DB, TB, TB, UpdateResult>,
  ReturnedCount,
  ReturnedObject extends object
> {
  /**
   * @param db Kysely database instance.
   * @param qb Kysely update query builder.
   * @param rowConverter Converts objects of type `UpdaterObject` to rows.
   */
  constructor(
    readonly db: Kysely<DB>,
    readonly qb: QB,
    protected readonly countTransform: (count: bigint) => ReturnedCount,
    protected readonly rowConverter: RowConverter
  ) {}

  /**
   * Runs the query, returning the number of rows updated, converted to
   * the required client representation.
   * @returns Number of rows updated, in client-requested representation.
   */
  async getCount(): Promise<ReturnedCount> {
    const result = await this.qb.executeTakeFirst();
    return this.countTransform(result.numUpdatedRows);
  }

  /**
   * Retrieves zero or more rows from the table, mapping the rows
   * to objects of type `SelectedObject`.
   * @returns An array of objects for the selected rows, possibly empty.
   */
  async getReturns(): Promise<ReturnedObject[]> {
    const results = await this.qb.execute();
    return this.rowConverter.transformRows(results);
  }

  /**
   * Retrieves a single row from the table, mapping the row
   * to an object of type `SelectedObject`.
   * @returns An object for the selected rows, or null if not found.
   */
  async run(): Promise<void> {
    await this.qb.execute();
  }

  /**
   * Modifies the underlying Kysely query builder. All columns given in
   * `SelectedColumns` are already selected, but you can select additional
   * columns or add columna aliases.
   * @param factory A function that takes the current query builder and
   *  returns a new query builder.
   */
  modify<NextQB extends UpdateQueryBuilder<DB, TB, TB, UpdateResult>>(
    factory: (qb: QB) => NextQB
  ): UpdateQuery<DB, TB, NextQB, ReturnedCount, ReturnedObject> {
    return new UpdateQuery(
      this.db,
      factory(this.qb),
      this.countTransform,
      this.rowConverter
    );
  }
}
