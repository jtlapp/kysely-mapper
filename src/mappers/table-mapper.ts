import { Insertable, Selectable, Selection, Updateable } from 'kysely';

import {
  SelectableColumnTuple,
  SelectedRow,
  SelectionColumn,
} from '../lib/type-utils.js';
import { TableMapperTransforms } from './table-mapper-transforms.js';
import { AbstractTableMapper } from './abstract-table-mapper.js';

/**
 * Table mapper that defaults to passing through all query inputs and output
 * unchanged, allowing the selective overloading of transforms.
 * @typeParam DB Interface whose fields are table names defining tables.
 * @typeParam TB Name of the table.
 * @typeParam KeyColumns Tuple of the names of the table's key columns.
 *  Defaults to `[]`, indicating no key columns. Supports up to 4 columns.
 * @typeParam SelectedColumns Columns to return from selection queries.
 *  Defaults to `['*']`, returning all columns. May specify aliases.
 * @typeParam SelectedObject Type of objects returned by select queries.
 * @typeParam InsertedObject Type of objects inserted into the table.
 * @typeParam UpdatingObject Type of objects used to update rows of the table.
 * @typeParam Type of the count of the number of affected rows.
 * @typeParam InsertReturnColumns Columns to return from the table on insert
 *  queries that return columns. `['*']` returns all columns; `[]` returns
 *  none. May specify aliases. Defaults to `KeyColumns`.
 * @typeParam UpdateReturnColumns Columns to return from the table on update
 *  queries that return columns. `['*']` returns all columns; `[]` returns
 *  none and is the default. May specify aliases.
 * @typeParam InsertReturn Type returned from inserts. Defaults to an object
 *  whose properties are the columns of `InsertReturnColumns`.
 * @typeParam UpdateReturn Type returned from updates. Defaults to an object
 *  whose properties are the columns of `UpdateReturnColumns`.
 */
export class TableMapper<
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
> extends AbstractTableMapper<
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
> {
  /**
   * Returns a new table mapper that uses the provided transformations, along
   * with the settings of the current table mapper.
   * @param transforms The transforms to use.
   * @returns A new table mapper that uses the provided transforms.
   */
  withTransforms<
    SelectedObject = SelectedRow<
      DB,
      TB,
      SelectedColumns extends ['*'] ? never : SelectedColumns[number],
      SelectedColumns
    >,
    InsertedObject = Insertable<DB[TB]>,
    UpdatingObject = Updateable<DB[TB]>,
    ReturnCount = bigint,
    InsertReturn = InsertReturnColumns extends ['*']
      ? Selectable<DB[TB]>
      : Selection<DB, TB, InsertReturnColumns[number]>,
    UpdateReturn = UpdateReturnColumns extends ['*']
      ? Selectable<DB[TB]>
      : Selection<DB, TB, UpdateReturnColumns[number]>
  >(
    transforms: Readonly<
      TableMapperTransforms<
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
      >
    >
  ) {
    const transformingTableMapper = new TableMapper<
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
    >(this.db, this.tableName, this.settings);
    transformingTableMapper.transforms = transforms;
    return transformingTableMapper;
  }
}
