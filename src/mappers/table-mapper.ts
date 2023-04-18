import { Insertable, Selectable, Selection, Updateable } from 'kysely';

import {
  SelectableColumnTuple,
  SelectedRow,
  SelectionColumn,
} from '../lib/type-utils';
import { TableMapperTransforms } from './table-mapper-transforms';
import { AbstractTableMapper } from './abstract-table-mapper';

/**
 * A mapper providing access to a single table.
 * @typeparam DB Interface whose fields are table names defining tables.
 * @typeparam TB Name of the table.
 * @typeparam KeyColumns Tuple of the names of the table's key columns.
 *  Defaults to `[]`, indicating no key columns.
 * @typeparam SelectedColumns Columns to return from selection queries.
 *  Defaults to `['*']`, returning all columns. May specify aliases.
 * @typeparam SelectedObject Type of objects returned by select queries.
 * @typeparam InsertedObject Type of objects inserted into the table.
 * @typeparam UpdatingObject Type of objects used to update rows of the table.
 * @typeparam ReturnCount Type of count query results.
 * @typeparam ReturnColumns Columns to return from the table on insert or
 *  update, except when explicitly requesting no columns. `['*']` returns
 *  all columns; `[]` returns none and is the default. May specify aliases.
 *  Defaults to `KeyColumns`.
 * @typeparam InsertReturnsSelectedObject Whether insert queries return
 *  `SelectedObject` or `DefaultReturnObject`.
 * @typeparam UpdateReturnsSelectedObjectWhenProvided Whether update queries
 *  return `SelectedObject` when the updating object is a `SelectedObject`;
 *  update queries otherwise return `DefaultReturnObject`.
 * @typeparam DefaultReturnObject Type of objects returned from inserts and
 *  updates, unless configured to return `SelectedObject`.
 */
export class TableMapper<
  DB,
  TB extends keyof DB & string,
  KeyColumns extends Readonly<SelectableColumnTuple<DB[TB]>> | [] = [],
  SelectedColumns extends Readonly<SelectionColumn<DB, TB>[]> | ['*'] = ['*'],
  SelectedObject extends object = SelectedRow<
    DB,
    TB,
    SelectedColumns extends ['*'] ? never : SelectedColumns[number],
    SelectedColumns
  >,
  InsertedObject extends object = Insertable<DB[TB]>,
  UpdatingObject extends object = Updateable<DB[TB]>,
  ReturnCount = bigint,
  ReturnColumns extends
    | Readonly<SelectionColumn<DB, TB>[]>
    | ['*'] = KeyColumns,
  InsertReturnsSelectedObject extends boolean = false,
  UpdateReturnsSelectedObjectWhenProvided extends boolean = false,
  DefaultReturnObject extends object = ReturnColumns extends ['*']
    ? Selectable<DB[TB]>
    : Selection<DB, TB, ReturnColumns[number]>
> extends AbstractTableMapper<
  DB,
  TB,
  KeyColumns,
  SelectedColumns,
  SelectedObject,
  InsertedObject,
  UpdatingObject,
  ReturnCount,
  ReturnColumns,
  InsertReturnsSelectedObject,
  UpdateReturnsSelectedObjectWhenProvided,
  DefaultReturnObject
> {
  /**
   * Returns a new table mapper that uses the provided transformations.
   * @param transforms The transforms to use.
   * @returns A new table mapper that uses the provided transforms.
   */
  withTransforms<
    SelectedObject extends object = SelectedRow<
      DB,
      TB,
      SelectedColumns extends ['*'] ? never : SelectedColumns[number],
      SelectedColumns
    >,
    InsertedObject extends object = Insertable<DB[TB]>,
    UpdatingObject extends object = Updateable<DB[TB]>,
    ReturnCount = bigint,
    DefaultReturnObject extends object = ReturnColumns extends ['*']
      ? Selectable<DB[TB]>
      : Selection<DB, TB, ReturnColumns[number]>
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
        ReturnColumns,
        InsertReturnsSelectedObject,
        UpdateReturnsSelectedObjectWhenProvided,
        DefaultReturnObject
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
      ReturnColumns,
      InsertReturnsSelectedObject,
      UpdateReturnsSelectedObjectWhenProvided,
      DefaultReturnObject
    >(this.db, this.tableName, this.settings);
    transformingTableMapper.transforms = transforms;
    return transformingTableMapper;
  }
}
