import { Kysely, SelectQueryBuilder } from 'kysely';

import { RowConverter } from '../lib/row-converter';

/**
 * Mapping query for selecting rows from a database table.
 */
export class MappingSelectQuery<
  DB,
  TB extends keyof DB & string,
  SelectedObject extends object,
  QB extends SelectQueryBuilder<DB, TB, any>
> {
  /**
   * @param db Kysely database instance.
   * @param qb Kysely select query builder.
   * @param rowConverter Converts rows to objects of type `SelectedObject`.
   */
  constructor(
    readonly db: Kysely<DB>,
    readonly qb: QB,
    // TODO: replace with selectTransform
    protected readonly rowConverter: RowConverter
  ) {}

  /**
   * Retrieves zero or more rows from the table, mapping the rows
   * to objects of type `SelectedObject`.
   * @returns An array of objects for the selected rows, possibly empty.
   */
  async getMany(): Promise<SelectedObject[]> {
    const results = await this.qb.execute();
    return this.rowConverter.transformRows(results);
  }

  /**
   * Retrieves a single row from the table, mapping the row
   * to an object of type `SelectedObject`.
   * @returns An object for the selected rows, or null if not found.
   */
  async getOne(): Promise<SelectedObject | null> {
    const result = await this.qb.executeTakeFirst();
    if (!result) return null;
    return this.rowConverter.transformRow(result);
  }

  /**
   * Modifies the underlying Kysely query builder. All columns given in
   * `SelectedColumns` are already selected, but you can select additional
   * columns or add columna aliases.
   * @param factory A function that takes the current query builder and
   *  returns a new query builder.
   */
  modify<NextQB extends SelectQueryBuilder<DB, TB, any>>(
    factory: (qb: QB) => NextQB
  ): MappingSelectQuery<DB, TB, SelectedObject, NextQB> {
    return new MappingSelectQuery(this.db, factory(this.qb), this.rowConverter);
  }
}
