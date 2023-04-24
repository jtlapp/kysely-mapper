/**
 * Restrict the values of an object to the specified columns, requiring that
 * all of the specified columns be present in the object.
 * @param obj The object to restrict.
 * @param toColumns The columns to restrict the object to.
 * @returns A new object with only the specified columns.
 */
export function restrictValues(obj: any, toColumns: Readonly<string[]>) {
  const values = {} as any;
  for (const column of toColumns) {
    const value = obj[column];
    // ensure the output of the applied transform works for the present query
    if (value === undefined) {
      throw Error(`Specified column '${column}' missing from values object`);
    }
    values[column] = value;
  }
  return values;
}
