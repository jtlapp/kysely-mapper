import { ParametersObject, QueryParameterMaker } from 'kysely-params';

import { AbstractTableMapper } from '../mappers/abstract-table-mapper.js';
import { SelectableColumnTuple, SelectionColumn } from './type-utils.js';
import { ParameterizableMappingQuery } from '../queries/parameterizable-query.js';

/**
 * Definition of the function that a caller provides to parameterize a
 * compilable query.
 */
export interface ParameterizableMappingQueryFactory<
  DB,
  TB extends keyof DB & string,
  KeyColumns extends Readonly<SelectableColumnTuple<DB[TB]>> | Readonly<[]>,
  SelectedColumns extends Readonly<SelectionColumn<DB, TB>[]> | ['*'],
  SelectedObject,
  InsertedObject,
  UpdatingObject,
  ReturnCount,
  InsertReturnColumns extends Readonly<SelectionColumn<DB, TB>[]> | ['*'],
  UpdateReturnColumns extends Readonly<SelectionColumn<DB, TB>[]> | ['*'],
  InsertReturn,
  UpdateReturn,
  M extends AbstractTableMapper<
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
  >,
  Parameters extends ParametersObject<Parameters>,
  Q extends ParameterizableMappingQuery
> {
  (factory: { mapper: M; param: QueryParameterMaker<Parameters>['param'] }): Q;
}
