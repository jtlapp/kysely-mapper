import { Kysely, InsertQueryBuilder, InsertResult } from 'kysely';

import { RowConverter } from '../lib/row-converter';

// TODO: see what else should be made readonly
// TODO: freeze objects

/**
 * Mapper query for inserting rows into a database table.
 */
export class MappingInsertQuery<
  DB,
  TB extends keyof DB & string,
  QB extends InsertQueryBuilder<DB, TB, InsertResult>,
  ReturnedObject extends object,
  IsSingleRow extends boolean
> {
  /**
   * @param db Kysely database instance.
   * @param qb Kysely update query builder.
   * @param rowConverter Converts objects of type `UpdaterObject` to rows.
   */
  constructor(
    readonly db: Kysely<DB>,
    readonly qb: QB,
    readonly isSingleRow: IsSingleRow,
    protected readonly rowConverter: RowConverter
  ) {}

  /**
   * Inserts one or more rows into the table. For each row inserted,
   * retrieves the columns specified in the `returnColumns` option,
   * which are returned unless `insertReturnTransform` transforms them
   * into `ReturnedObject`. If `returnColumns` is empty, returns nothing.
   * @returns Returns a `ReturnedObject` for each inserted object. Will
   *  be an array when `objOrObjs` is an array, will be a single object
   *  otherwise. Returns nothing (void) if `returnColumns` is empty.
   * @see this.insertNoReturns
   */
  getReturns(): Promise<
    IsSingleRow extends true ? ReturnedObject : ReturnedObject[]
  >;

  async getReturns(): Promise<ReturnedObject | ReturnedObject[]> {
    return this.isSingleRow
      ? this.rowConverter.transformRow(await this.qb.executeTakeFirst())
      : this.rowConverter.transformRows(await this.qb.execute());
  }

  /**
   * Inserts rows into the table without returning any columns.
   */
  async run(): Promise<void> {
    await this.qb.execute();
  }

  /**
   * Modifies the underlying Kysely query builder.
   * @param factory A function that takes the current query builder and
   *  returns a new query builder.
   */
  modify<NextQB extends InsertQueryBuilder<DB, TB, InsertResult>>(
    factory: (qb: QB) => NextQB
  ): MappingInsertQuery<DB, TB, NextQB, ReturnedObject, IsSingleRow> {
    return new MappingInsertQuery(
      this.db,
      factory(this.qb),
      this.isSingleRow,
      this.rowConverter
    );
  }
}
