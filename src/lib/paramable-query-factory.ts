import { ParametersObject, QueryParameterMaker } from 'kysely-params';
import { AbstractTableMapper } from '../mappers/abstract-table-mapper';
import {
  AllColumns,
  SelectableColumnTuple,
  SelectionColumn,
} from './type-utils';
import { ParameterizableMappingQuery } from '../queries/paramable-query';

/**
 * Definition of the function that a caller provides to parameterize a
 * compilable query.
 */
export interface ParameterizableMappingQueryFactory<
  DB,
  TB extends keyof DB & string,
  KeyColumns extends Readonly<SelectableColumnTuple<DB[TB]>> | [],
  SelectedColumns extends Readonly<SelectionColumn<DB, TB>[]> | AllColumns,
  SelectedObject extends object,
  InsertedObject extends object,
  UpdatingObject extends object,
  ReturnCount,
  ReturnColumns extends Readonly<SelectionColumn<DB, TB>[]> | AllColumns,
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
