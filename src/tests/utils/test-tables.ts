import { Kysely, Generated, sql } from 'kysely';

// list tables after those they depend on
const TABLE_NAMES = ['posts', 'users'];

export interface Users {
  id: Generated<number>;
  handle: string;
  name: string;
  email: string | null;
}

export interface Posts {
  id: Generated<number>;
  userId: number;
  title: string;
  likeCount: number;
  createdAt: Generated<Date>;
}

export interface Database {
  users: Users;
  posts: Posts;
}

export async function createTables(db: Kysely<Database>) {
  await _createTableWithId(db, 'users')
    .addColumn('handle', 'varchar(255)', (col) => col.notNull())
    .addColumn('name', 'varchar(255)', (col) => col.notNull())
    .addColumn('email', 'varchar(255)')
    .execute();

  await _createTableWithId(db, 'posts')
    .addColumn('userId', 'integer', (col) =>
      col.references('users.id').onDelete('cascade').notNull()
    )
    .addColumn('title', 'varchar(255)', (col) => col.unique().notNull())
    .addColumn('likeCount', 'integer', (col) => col.notNull())
    .addColumn('createdAt', 'timestamp', (col) =>
      col.defaultTo(sql`current_timestamp`).notNull()
    )
    .execute();

  return db;
}

export async function dropTables(db: Kysely<Database>): Promise<void> {
  for (const table of TABLE_NAMES) {
    await db.schema.dropTable(table).ifExists().execute();
  }
}

function _createTableWithId(db: Kysely<Database>, tableName: string) {
  return db.schema
    .createTable(tableName)
    .addColumn('id', 'integer', (col) => col.autoIncrement().primaryKey());
}
