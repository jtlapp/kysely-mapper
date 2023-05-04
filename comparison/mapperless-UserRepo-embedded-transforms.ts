import { Kysely } from "kysely";

import { User, UserID } from "@fieldzoo/model";

import { Database } from "../tables/table-interfaces";

export class UserRepo {
  constructor(readonly db: Kysely<Database>) {}

  async add(user: User): Promise<User> {
    const returns = await this.db
      .insertInto("users")
      .values(this.upsertTransform(user))
      .returning(["id", "createdAt", "modifiedAt"])
      .executeTakeFirst();
    return User.castFrom({ ...user, ...returns });
  }

  async deleteByID(id: UserID): Promise<boolean> {
    const result = await this.db
      .deleteFrom("users")
      .where("id", "=", id)
      .executeTakeFirst();
    return result.numDeletedRows > 0;
  }

  async getByID(id: UserID): Promise<User | null> {
    const row = await this.db
      .selectFrom("users")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? User.castFrom(row) : null;
  }

  async update(user: User): Promise<boolean> {
    const returns = await this.db
      .updateTable("users")
      .set(this.upsertTransform(user))
      .where("id", "=", user.id)
      .returning(["modifiedAt"])
      .executeTakeFirst();
    if (returns === undefined) {
      return false;
    }
    Object.assign(user, returns) as User;
    return true;
  }

  private upsertTransform(user: User) {
    const values = { ...user } as any;
    delete values["id"];
    delete values["createdAt"];
    delete values["modifiedAt"];
    return values;
  }
}
