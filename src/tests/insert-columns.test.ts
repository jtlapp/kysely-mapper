import { Kysely } from 'kysely';

import { createDB, resetDB, destroyDB } from './utils/test-setup';
import { Database } from './utils/test-tables';
import {
  createUserMapperReturningID,
  createUserMapperReturningNothing,
} from './utils/test-mappers';

let db: Kysely<Database>;

let userMapperReturningID: ReturnType<typeof createUserMapperReturningID>;

let userMapperReturningNothing: ReturnType<
  typeof createUserMapperReturningNothing
>;

beforeAll(async () => {
  db = await createDB();
  userMapperReturningNothing = createUserMapperReturningNothing(db);
  userMapperReturningID = createUserMapperReturningID(db);
});
beforeEach(() => resetDB(db));
afterAll(() => destroyDB(db));
describe('inserting specific columns', () => {
  it('subsets inserted columns, excluding ID', async () => {
    const subsetQuery = userMapperReturningID
      .insert()
      .columns(['name', 'handle'] as const); // allows readonly array
    const insertReturn = await subsetQuery.returnOne({
      id: 10,
      name: 'John Doe',
      handle: 'johndoe',
      email: 'jdoe@abc.def',
    });
    expect(insertReturn).toEqual({ id: expect.any(Number) });

    const readUser = await userMapperReturningID.select().returnAll();
    expect(readUser).toEqual([
      { id: 1, name: 'John Doe', handle: 'johndoe', email: null },
    ]);
  });

  it('subsets inserted columns, including ID', async () => {
    const subsetQuery = userMapperReturningNothing
      .insert()
      .columns(['id', 'name', 'handle']);
    await subsetQuery.run({
      id: 10,
      name: 'John Doe',
      handle: 'johndoe',
      email: 'jdoe@abc.def',
    });

    const readUser = await userMapperReturningID.select().returnAll();
    expect(readUser).toEqual([
      { id: 10, name: 'John Doe', handle: 'johndoe', email: null },
    ]);
  });

  it('requires all subsetted columns to be inserted', async () => {
    const subsetQuery = userMapperReturningID
      .insert()
      .columns(['name', 'handle', 'email']);

    const insertValues = { name: 'John Doe', handle: 'johndoe' };

    expect(() => subsetQuery.returnOne(insertValues)).rejects.toThrow(
      `column 'email' missing`
    );

    const success = await subsetQuery.run({ ...insertValues, email: null });
    expect(success).toBe(true);
  });

  it('provides insertTransform with column subset', async () => {
    expect.assertions(1);
    const mapper = userMapperReturningID.withTransforms({
      insertTransform: (source, columns) => {
        expect(columns).toEqual(['name', 'handle']);
        return source;
      },
    });
    await mapper.insert().columns(['name', 'handle']).run({
      name: 'John Doe',
      handle: 'johndoe',
      email: 'jdoe@abc.def',
    });
  });
});
