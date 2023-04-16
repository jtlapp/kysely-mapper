import { ParametersObject, QueryParameterMaker } from 'kysely-params';
import { TableMapper } from '../mappers/table-mapper';
import { SelectableColumnTuple, SelectionColumn } from './type-utils';
import { ParameterizableMappingQuery } from '../queries/paramable-query';

/**
 * Definition of the function that a caller provides to parameterize a
 * compilable query.
 */
export interface ParameterizableMappingQueryFactory<
  DB,
  TB extends keyof DB & string,
  KeyColumns extends SelectableColumnTuple<DB[TB]> | [],
  SelectedColumns extends SelectionColumn<DB, TB>[] | ['*'],
  SelectedObject extends object,
  InsertedObject extends object,
  UpdatingObject extends object,
  ReturnCount,
  ReturnColumns extends SelectionColumn<DB, TB>[] | ['*'],
  InsertReturnsSelectedObject extends boolean,
  UpdateReturnsSelectedObjectWhenProvided extends boolean,
  DefaultReturnObject extends object,
  M extends TableMapper<
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
  >,
  P extends ParametersObject<P>,
  Q extends ParameterizableMappingQuery
> {
  (factory: { mapper: M; param: QueryParameterMaker<P>['param'] }): Q;
}
