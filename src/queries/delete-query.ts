import { DeleteQueryBuilder, DeleteResult, Kysely } from 'kysely';
import { ParameterizableMappingQuery } from './parameterizable-query';
import { ParametersObject } from 'kysely-params';
import { CompilingMappingDeleteQuery } from './compiling-delete-query';
import { CountTransform } from '../mappers/table-mapper-transforms';

/**
 * Mapping query for deleting rows from a database table.
 */
export class MappingDeleteQuery<
  DB,
  TB extends keyof DB & string,
  QB extends DeleteQueryBuilder<DB, TB, DeleteResult>,
  ReturnCount
> implements ParameterizableMappingQuery
{
  /**
   * @param db Kysely database instance.
   * @param qb Kysely delete query builder.
   * @param countTransform Function that transforms returned row counts
   */
  constructor(
    protected readonly db: Kysely<DB>,
    protected readonly qb: QB,
    protected readonly transforms: Readonly<CountTransform<ReturnCount>>
  ) {}

  /**
   * Returns a compiling query that can be executed multiple times with
   * different parameters (if any parameters were provided), but which only
   * compiles the underlying Kysely query builder on the first execution.
   * Frees the query builder on the first execution to reduce memory usage.
   * @typeparam P Record characterizing the parameter names and types
   *  that were previously embedded in the query, if any.
   * @returns A compiling delete query.
   */
  compile<P extends ParametersObject<P> = {}>(): CompilingMappingDeleteQuery<
    DB,
    TB,
    QB,
    ReturnCount,
    P
  > {
    return new CompilingMappingDeleteQuery(this.db, this.qb, this.transforms);
  }

  /**
   * Runs the query, returning the number of rows deleted, converted to
   * the required client representation.
   * @returns Number of rows deleted, in client-requested representation.
   */
  async returnCount(): Promise<ReturnCount> {
    const result = await this.qb.executeTakeFirst();
    return this.transforms.countTransform === undefined
      ? (result.numDeletedRows as ReturnCount)
      : this.transforms.countTransform(result.numDeletedRows);
  }

  /**
   * Modifies the underlying Kysely query builder.
   * @param factory A function that takes the current query builder and
   *  returns a new query builder.
   */
  modify<NextQB extends DeleteQueryBuilder<DB, any, DeleteResult>>(
    factory: (qb: QB) => NextQB
  ): MappingDeleteQuery<DB, TB, NextQB, ReturnCount> {
    return new MappingDeleteQuery(this.db, factory(this.qb), this.transforms);
  }

  /**
   * Runs the query, deleting the indicated rows, returning nothing.
   * @returns `true` if any rows were deleted, `false` otherwise.
   */
  async run(): Promise<boolean> {
    const results = await this.qb.executeTakeFirst();
    return results.numDeletedRows !== BigInt(0);
  }
}
