import { Kysely } from 'kysely';

import { createDB, resetDB, destroyDB } from './utils/test-setup';
import { Database } from './utils/test-tables';
import { createUserMapperReturningID } from './utils/test-mappers';
import { USERS } from './utils/test-objects';
import { TableMapper } from '../mappers/table-mapper';

let db: Kysely<Database>;
let userMapperReturningID: ReturnType<typeof createUserMapperReturningID>;

beforeAll(async () => {
  db = await createDB();
  userMapperReturningID = createUserMapperReturningID(db);
});
beforeEach(() => resetDB(db));
afterAll(() => destroyDB(db));

describe('updating specific columns', () => {
  it('subsets updating columns, excluding ID', async () => {
    const insertReturns = await userMapperReturningID.insert().returnAll(USERS);

    const updateValues = { id: 100, name: 'Sue Rex', email: 'rex@abc.def' };
    const subsetQuery = userMapperReturningID
      .update('id', '=', insertReturns[0].id)
      .columns(['name'] as const); // allows readonly array
    const updateReturns = await subsetQuery.returnAll(updateValues);
    expect(updateReturns).toEqual([{ id: insertReturns[0].id }]);

    const readUsers = await userMapperReturningID
      .select('id', '=', insertReturns[0].id)
      .returnOne();
    expect(readUsers).toEqual({
      id: insertReturns[0].id,
      name: 'Sue Rex',
      email: USERS[0].email,
      handle: USERS[0].handle,
    });
  });

  it('subsets updating columns, including ID', async () => {
    const insertReturns = await userMapperReturningID.insert().returnAll(USERS);

    const updateValues = { id: 100, name: 'Sue Rex', email: 'rex@abc.def' };
    const subsetQuery = userMapperReturningID

      .update('id', '=', insertReturns[0].id)
      .columns(['id', 'name', 'email']);
    const updateReturns = await subsetQuery.returnAll(updateValues);
    expect(updateReturns).toEqual([{ id: 100 }]);

    const readUsers = await userMapperReturningID
      .select('id', '=', 100)
      .returnOne();
    expect(readUsers).toEqual({
      id: 100,
      name: 'Sue Rex',
      email: 'rex@abc.def',
      handle: USERS[0].handle,
    });
  });

  it('requires all subsetted columns to be updated', async () => {
    const insertReturns = await userMapperReturningID.insert().returnAll(USERS);

    const updateValues = { name: 'Sue Rex' };

    const subsetQuery = userMapperReturningID
      .update('id', '=', insertReturns[0].id)
      .columns(['name', 'email']);
    expect(() => subsetQuery.returnAll(updateValues)).rejects.toThrow(
      `column 'email' missing`
    );

    const success = await subsetQuery.run({ ...updateValues, email: null });
    expect(success).toBe(true);
  });

  it('provides updateTransform with column subset', async () => {
    expect.assertions(1);
    const mapper = new TableMapper(db, 'users').withTransforms({
      updateTransform: (source, columns) => {
        expect(columns).toEqual(['name', 'handle']);
        return source;
      },
    });
    await mapper.update().columns(['name', 'handle']).run({
      name: 'John Doe',
      handle: 'johndoe',
      email: 'jdoe@abc.def',
    });
  });
});
