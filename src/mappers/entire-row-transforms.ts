import { Insertable, Selectable, Updateable } from 'kysely';
import {
  SelectableColumnTuple,
  SelectedRow,
  SelectionColumn,
} from '../lib/type-utils';
import { TableMapperTransforms } from './table-mapper-transforms';

/**
 * Transforms for a table mapper that only receives and returns
 * entire table rows, given by type `Selectable<DB[TB]>`.
 * @typeParam DB Interface whose fields are table names defining tables.
 * @typeParam TB Name of the table.
 * @typeParam KeyColumns Tuple of the names of the table's key columns.
 *  Defaults to `[]`, indicating no key columns. Supports up to 4 columns.
 * @typeParam InsertReturnColumns Columns to return from the table on insert
 *  queries that return columns. `['*']` returns all columns; `[]` returns
 *  none. May specify aliases. Defaults to `KeyColumns`.
 * @typeParam UpdateReturnColumns Columns to return from the table on update
 *  queries that return columns. `['*']` returns all columns; `[]` returns
 *  none and is the default. May specify aliases.
 */
export class EntireRowTransforms<
  DB,
  TB extends keyof DB & string,
  KeyColumns extends Readonly<SelectableColumnTuple<DB[TB]>> | Readonly<[]>,
  InsertReturnColumns extends Readonly<SelectionColumn<DB, TB>[]> | ['*'],
  UpdateReturnColumns extends Readonly<SelectionColumn<DB, TB>[]> | ['*']
> implements
    Required<
      TableMapperTransforms<
        DB,
        TB,
        KeyColumns,
        ['*'],
        Selectable<DB[TB]>,
        Selectable<DB[TB]>,
        Selectable<DB[TB]>,
        number,
        InsertReturnColumns,
        UpdateReturnColumns,
        Selectable<DB[TB]>,
        Selectable<DB[TB]>
      >
    >
{
  /**
   * Constructs an object providing transforms for entire table rows.
   */
  constructor(readonly keyColumns: KeyColumns) {}

  /**
   * Transform a count of the number of rows affected into a number.
   */
  countTransform(count: bigint) {
    return Number(count);
  }

  /**
   * Transforms inserted objects into inserted rows, removing the columns
   * that are keys having falsy values.
   */
  insertTransform(
    obj: Selectable<DB[TB]>,
    _columns: Readonly<(keyof Insertable<DB[TB]>)[]> | ['*']
  ) {
    const insertedValues = { ...obj };
    this.keyColumns.forEach((column) => {
      if (!obj[column as unknown as keyof Selectable<DB[TB]>]) {
        delete insertedValues[column as unknown as keyof Selectable<DB[TB]>];
      }
    });
    return insertedValues as unknown as Insertable<DB[TB]>;
  }

  /**
   * Transforms the returns of an insert query into the the object returned
   * to the caller, merging the returned values into the inserted object.
   */
  insertReturnTransform(
    source: Selectable<DB[TB]>,
    returns: InsertReturnColumns extends []
      ? never
      : SelectedRow<
          DB,
          TB,
          InsertReturnColumns extends ['*']
            ? never
            : InsertReturnColumns[number],
          InsertReturnColumns
        >
  ) {
    if (returns === undefined) return source;
    return { ...source, ...returns };
  }

  /**
   * Returns selected rows to the caller as selected objects, unchanged.
   */
  selectTransform(row: Selectable<DB[TB]>) {
    return row;
  }

  /**
   * Provides updating objects as the update values for an update query.
   */
  updateTransform(
    source: Selectable<DB[TB]>,
    _columns: Readonly<(keyof Updateable<DB[TB]>)[]> | ['*']
  ) {
    return source as Updateable<DB[TB]>;
  }

  /**
   * Transforms the returns of an update query into the the object returned
   * to the caller, merging the returned values into the updating object.
   */
  updateReturnTransform(
    source: Selectable<DB[TB]>,
    returns: UpdateReturnColumns extends []
      ? never
      : SelectedRow<
          DB,
          TB,
          UpdateReturnColumns extends ['*']
            ? never
            : UpdateReturnColumns[number],
          UpdateReturnColumns
        >
  ) {
    if (returns === undefined) return source;
    return { ...source, ...returns };
  }
}
