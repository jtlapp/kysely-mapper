import { Kysely, Selectable, Selection } from "kysely";

import { User, UserID } from "@fieldzoo/model";

import { Database, Users } from "../tables/table-interfaces";

export class UserRepo {
  constructor(readonly db: Kysely<Database>) {}

  async add(user: User): Promise<User> {
    const returns = await this.db
      .insertInto("users")
      .values(this.upsertTransform(user))
      .returning(["id", "createdAt", "modifiedAt"])
      .executeTakeFirst();
    return this.insertReturnTransform(user, returns!);
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
    return row ? this.selectTransform(row) : null;
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
    this.updateReturnTransform(user, returns!);
    return true;
  }

  private upsertTransform(user: User) {
    const values = { ...user } as any;
    delete values["id"];
    delete values["createdAt"];
    delete values["modifiedAt"];
    return values;
  }

  private insertReturnTransform(
    user: User,
    returns: Selection<Database, "users", "id" | "createdAt" | "modifiedAt">
  ) {
    return User.castFrom({ ...user, ...returns });
  }

  private updateReturnTransform(
    user: User,
    returns: Selection<Database, "users", "modifiedAt">
  ) {
    return Object.assign(user, returns) as User;
  }

  private selectTransform(row: Selectable<Users>) {
    return User.castFrom(row);
  }
}
