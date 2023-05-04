import { Kysely } from 'kysely';
import { TableMapper } from 'kysely-mapper';
import { User, UserID } from '@fieldzoo/model';
import { Database } from '../tables/table-interfaces';

export class UserRepo {
  readonly #table: ReturnType<UserRepo['getMapper']>;

  constructor(readonly db: Kysely<Database>) {
    this.#table = this.getMapper(db);
  }

  async add(user: User): Promise<User> {
    return this.#table.insert().returnOne(user);
  }

  async deleteByID(id: UserID): Promise<boolean> {
    return this.#table.delete(id).run();
  }

  async getByID(id: UserID): Promise<User | null> {
    return this.#table.select(id).returnOne();
  }

  async update(user: User): Promise<boolean> {
    return (await this.#table.update(user.id).returnOne(user)) !== null;
  }

  private getMapper(db: Kysely<Database>) {
    const upsertTransform = (user: User) => {
      const values = { ...user } as any;
      delete values['id'];
      delete values['createdAt'];
      delete values['modifiedAt'];
      return values;
    };

    return new TableMapper(db, 'users', {
      keyColumns: ['id'],
      insertReturnColumns: ['id', 'createdAt', 'modifiedAt'],
      updateReturnColumns: ['modifiedAt'],
    }).withTransforms({
      insertTransform: upsertTransform,
      insertReturnTransform: (user: User, returns) =>
        User.castFrom({ ...user, ...returns }),
      updateTransform: upsertTransform,
      updateReturnTransform: (user: User, returns) =>
        Object.assign(user, returns) as User,
      selectTransform: (row) => User.castFrom(row),
      countTransform: (count) => Number(count),
    });
  }
}
