import { ParametersObject, QueryParameterMaker } from 'kysely-params';
import { AbstractTableMapper } from '../mappers/abstract-table-mapper';
import { SelectableColumnTuple, SelectionColumn } from './type-utils';
import { ParameterizableMappingQuery } from '../queries/parameterizable-query';

/**
 * Definition of the function that a caller provides to parameterize a
 * compilable query.
 */
export interface ParameterizableMappingQueryFactory<
  DB,
  TB extends keyof DB & string,
  KeyColumns extends Readonly<SelectableColumnTuple<DB[TB]>> | [],
  SelectedColumns extends Readonly<SelectionColumn<DB, TB>[]> | ['*'],
  SelectedObject extends object,
  InsertedObject extends object,
  UpdatingObject extends object,
  ReturnCount,
  ReturnColumns extends Readonly<SelectionColumn<DB, TB>[]> | ['*'],
  InsertReturnsSelectedObject extends boolean,
  UpdateReturnsSelectedObjectWhenProvided extends boolean,
  DefaultReturnObject extends object,
  M extends AbstractTableMapper<
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
