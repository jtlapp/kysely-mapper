import { Kysely } from 'kysely';

import { createDB, resetDB, destroyDB } from './utils/test-setup';
import { Database } from './utils/test-tables';
import { createUserMapperReturningID } from './utils/test-mappers';
import { USERS } from './utils/test-objects';

let db: Kysely<Database>;
let userMapperReturningID: ReturnType<typeof createUserMapperReturningID>;

beforeAll(async () => {
  db = await createDB();
  userMapperReturningID = createUserMapperReturningID(db);
});
beforeEach(() => resetDB(db));
afterAll(() => destroyDB(db));

describe('transactions', () => {
  it('queries commit when transaction succeeds', async () => {
    const insertReturn0 = await userMapperReturningID
      .insert()
      .returnOne(USERS[0]);
    const insertReturn1 = await userMapperReturningID
      .insert()
      .returnOne(USERS[1]);
    const updateValues0 = { email: 'updated.email0@xyz.pdq' };
    const updateValues1 = { email: 'updated.email1@xyz.pdq' };

    await db.transaction().execute(async (trx) => {
      const trxMapper = userMapperReturningID.forTransaction(trx);

      const updateCount0 = await trxMapper
        .update({ id: insertReturn0.id })
        .returnCount(updateValues0);
      expect(updateCount0).toEqual(1);

      const updateCount1 = await trxMapper
        .update({ id: insertReturn1.id })
        .returnCount(updateValues1);
      expect(updateCount1).toEqual(1);
    });

    const readUser0 = await userMapperReturningID
      .select('id', '=', insertReturn0.id)
      .returnOne();
    expect(readUser0?.email).toEqual(updateValues0.email);

    const readUser1 = await userMapperReturningID
      .select('id', '=', insertReturn1.id)
      .returnOne();
    expect(readUser1?.email).toEqual(updateValues1.email);
  });

  it('queries do not commit when transaction fails', async () => {
    const insertReturn0 = await userMapperReturningID
      .insert()
      .returnOne(USERS[0]);
    const insertReturn1 = await userMapperReturningID
      .insert()
      .returnOne(USERS[1]);
    const updateValues0 = { email: 'updated.email0@xyz.pdq' };
    const updateValues1 = { email: 'updated.email1@xyz.pdq' };

    try {
      await db.transaction().execute(async (trx) => {
        const trxMapper = userMapperReturningID.forTransaction(trx);

        const updateCount0 = await trxMapper
          .update({ id: insertReturn0.id })
          .returnCount(updateValues0);
        expect(updateCount0).toEqual(1);

        const updateCount1 = await trxMapper
          .update({ id: insertReturn1.id })
          .returnCount(updateValues1);
        expect(updateCount1).toEqual(1);

        throw Error('failed next query (not present)');
      });
    } catch (e: any) {
      if (e.message !== 'failed next query (not present)') {
        throw e;
      }
    }

    const readUser0 = await userMapperReturningID
      .select('id', '=', insertReturn0.id)
      .returnOne();
    expect(readUser0?.email).toEqual(USERS[0].email);

    const readUser1 = await userMapperReturningID
      .select('id', '=', insertReturn1.id)
      .returnOne();
    expect(readUser1?.email).toEqual(USERS[1].email);
  });
});
