import { Insertable } from 'kysely';

import { Users, Posts } from './test-tables';
import { InsertedUser, ReturnedUser, SelectedUser } from './test-types';

export const USERS: Insertable<Users>[] = [
  {
    handle: 'handle1',
    name: 'Sue',
    email: 'foo1@bar.com',
  },
  {
    handle: 'handle2',
    name: 'Fred',
    email: 'foo2@bar.com',
  },
  {
    handle: 'handle3',
    name: 'Sue',
    email: 'foo3@bar.com',
  },
];

export const POSTS: Insertable<Posts>[] = [
  {
    userId: 0,
    title: 'About Something',
    likeCount: 0,
  },
  {
    userId: 0,
    title: 'And Another Thing',
    likeCount: 10,
  },
  {
    userId: 0,
    title: 'Still One More Thing',
    likeCount: 1000,
  },
];

export const userRow1 = {
  name: 'John Smith',
  handle: 'jsmith',
  email: 'jsmith@xyz.pdq',
};
export const userRow2 = {
  name: 'Jane Doe',
  handle: 'jdoe',
  email: 'jdoe@xyz.pdq',
};
export const userRow3 = {
  name: 'Mary Sue',
  handle: 'msue',
  email: 'msue@xyz.pdq',
};

export const userObject1 = {
  firstName: 'John',
  lastName: 'Smith',
  handle: userRow1.handle,
  email: userRow1.email,
};
export const userObject2 = {
  firstName: 'Jane',
  lastName: 'Doe',
  handle: userRow2.handle,
  email: userRow2.email,
};
export const userObject3 = {
  firstName: 'Mary',
  lastName: 'Sue',
  handle: userRow3.handle,
  email: userRow3.email,
};

export const selectedUser1 = SelectedUser.create(1, userObject1);
export const selectedUser2 = SelectedUser.create(2, userObject2);
export const selectedUser3 = SelectedUser.create(3, userObject3);

export const insertedUser1 = InsertedUser.create(0, userObject1);
export const insertedUser2 = InsertedUser.create(0, userObject2);
export const insertedUser3 = InsertedUser.create(0, userObject3);

export const insertReturnedUser1 = ReturnedUser.create(1, userObject1);
export const insertReturnedUser2 = ReturnedUser.create(2, userObject2);
export const insertReturnedUser3 = ReturnedUser.create(3, userObject3);
