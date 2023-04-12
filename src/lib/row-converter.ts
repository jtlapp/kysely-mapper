/**
 * Converts query result rows into the mapped object type.
 */
// TODO: delete class when able
export class RowConverter {
  /**
   * Transforms a result row into the mapped object type.
   */
  readonly transformRow: <MappedObject>(source: object) => MappedObject = (
    row
  ) => row as any;

  /**
   * Transforms an array of result rows into mapped objects.
   */
  readonly transformRows: <MappedObject>(source: object[]) => MappedObject[] = (
    rows
  ) => rows as any[];

  constructor(transform?: (row: any) => any) {
    if (transform) {
      this.transformRow = transform as any;
      this.transformRows = (rows) => rows.map((obj) => this.transformRow(obj));
    }
  }
}

/**
 * A result converter that does not transform rows.
 */
export const noOpRowConverter = new RowConverter();
