/**
 * Types and classes used in tests.
 */

type VariableFieldsOf<T> = Omit<T, 'id' | '__type'>;

export class User {
  constructor(
    public id: number,
    public firstName: string,
    public lastName: string,
    public handle: string,
    public email: string
  ) {}

  static create(id: number, obj: VariableFieldsOf<User>): User {
    return new User(id, obj.firstName, obj.lastName, obj.handle, obj.email);
  }
}

export class InsertedUser extends User {
  readonly __type = 'InsertedUser';

  static create(id: number, obj: VariableFieldsOf<InsertedUser>): InsertedUser {
    return new InsertedUser(
      id,
      obj.firstName,
      obj.lastName,
      obj.handle,
      obj.email
    );
  }
}

export class SelectedUser extends User {
  readonly __type = 'SelectedUser';

  static create(id: number, obj: VariableFieldsOf<SelectedUser>): SelectedUser {
    return new SelectedUser(
      id,
      obj.firstName,
      obj.lastName,
      obj.handle,
      obj.email
    );
  }
}

export class UpdatingUser extends User {
  readonly __type = 'UpdatingUser';

  static create(id: number, obj: VariableFieldsOf<UpdatingUser>): UpdatingUser {
    return new UpdatingUser(
      id,
      obj.firstName,
      obj.lastName,
      obj.handle,
      obj.email
    );
  }
}

export class ReturnedUser extends User {
  readonly __type = 'ReturnedUser';

  static create(id: number, obj: VariableFieldsOf<ReturnedUser>): ReturnedUser {
    return new ReturnedUser(
      id,
      obj.firstName,
      obj.lastName,
      obj.handle,
      obj.email
    );
  }
}
