import { Insertable, Selectable, Updateable } from 'kysely';
import {
  SelectableColumnTuple,
  SelectedRow,
  SelectionColumn,
} from '../lib/type-utils';
import { TableMapperTransforms } from './table-mapper-transforms';

/**
 * Default transforms for a table mapper that only receives and returns
 * instances of `Selectable<DB[TB]>`.
 */
export class DefaultUniformTransforms<
  DB,
  TB extends keyof DB & string,
  KeyColumns extends Readonly<SelectableColumnTuple<DB[TB]>> | Readonly<[]>,
  SelectedColumns extends Readonly<SelectionColumn<DB, TB>[]> | ['*'],
  InsertReturnColumns extends Readonly<SelectionColumn<DB, TB>[]> | ['*'],
  UpdateReturnColumns extends Readonly<SelectionColumn<DB, TB>[]> | ['*']
> implements
    Required<
      TableMapperTransforms<
        DB,
        TB,
        KeyColumns,
        SelectedColumns,
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
  insertTransform(obj: Selectable<DB[TB]>) {
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
  selectTransform(
    row: SelectedRow<
      DB,
      TB,
      SelectedColumns extends ['*'] ? never : SelectedColumns[number],
      SelectedColumns
    >
  ) {
    return row as Selectable<DB[TB]>;
  }

  /**
   * Provides updating objects as the update values for an update query.
   */
  updateTransform(source: Selectable<DB[TB]>) {
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
