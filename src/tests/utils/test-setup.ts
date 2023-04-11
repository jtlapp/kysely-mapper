import Sqlite3 from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';

import { Database, createTables, dropTables } from './test-tables';

export async function createDB() {
  return new Kysely<Database>({
    dialect: new SqliteDialect({
      database: new Sqlite3(':memory:'),
    }),
  });
}

export async function resetDB(db: Kysely<Database>) {
  await dropTables(db);
  await createTables(db);
}

export async function destroyDB<DB>(db: Kysely<DB>) {
  return db.destroy();
}
