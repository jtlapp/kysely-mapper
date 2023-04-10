import { Insertable, Kysely, Selectable } from "kysely";

import { TableLens } from "../../lenses/table-lens/table-lens";
import { Database, Users } from "./test-tables";

const countTransform = (count: bigint) => Number(count);

export class UserTableLensReturningDefault extends TableLens<
  Database,
  "users"
> {
  constructor(readonly db: Kysely<Database>) {
    super(db, "users");
  }
}

export class UserTableLensReturningNothing extends TableLens<
  Database,
  "users",
  ["*"],
  Selectable<Users>,
  Insertable<Users>,
  Partial<Insertable<Users>>,
  [],
  number
> {
  constructor(readonly db: Kysely<Database>) {
    super(db, "users", { returnColumns: [], countTransform });
  }
}

export class UserTableLensReturningID extends TableLens<
  Database,
  "users",
  ["*"],
  Selectable<Users>,
  Insertable<Users>,
  Partial<Insertable<Users>>,
  ["id"],
  number
> {
  constructor(readonly db: Kysely<Database>) {
    super(db, "users", { returnColumns: ["id"], countTransform });
  }
}

export class UserTableLensReturningIDAndHandle extends TableLens<
  Database,
  "users",
  ["*"],
  Selectable<Users>,
  Insertable<Users>,
  Partial<Insertable<Users>>,
  ["id", "handle"],
  number
> {
  constructor(readonly db: Kysely<Database>) {
    super(db, "users", { returnColumns: ["id", "handle"], countTransform });
  }
}

export class UserTableLensReturningAll extends TableLens<
  Database,
  "users",
  ["*"],
  Selectable<Users>,
  Insertable<Users>,
  Partial<Insertable<Users>>,
  ["*"],
  number
> {
  constructor(readonly db: Kysely<Database>) {
    super(db, "users", { returnColumns: ["*"], countTransform });
  }
}
