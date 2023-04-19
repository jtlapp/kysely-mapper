# kysely-params

Flexible Kysely-based utility for mapping between tables and objects

## Overview

This utility helps eliminate the boilerplate associated with mapping between database tables and objects. Unconfigured, the utility does no mapping and only serves as a shorthand for accessing tables using column names as fields. When configured, it provides nearly complete control over how objects map to and from individual tables. Mappings can be tailored per table and can vary in degree of ORM functionality. All queries are based on [Kysely](https://github.com/kysely-org/kysely) and give you access to the underlying query builders for further modification. The utility also supports compiling its object-mapping queries, parameterized for variation from run to run.

## Installation

Install both Kysely and this package with your preferred dependency manager:

```
npm install kysely kysely-mapper

yarn add kysely kysely-mapper

pnpm add kysely kysely-mapper
```

## Introduction

This package provides two concrete classes for mapping tables: `TableMapper` and `UniformTableMapper`. `TableMapper` is a generic mapping utility that makes few assumptions about mapping requirements. `UniformTableMapper` provides a configuration that assumes queries all insert, update, select, and return the same type of object. You can use either of these classes or design your own, such as by subclassing `AbstractTableMapper`.

For the examples that follow, assume we have the following 'users' table:

- **id**: auto-incrementing integer primary key
- **name**: text
- **birthyear**: integer
- **modified**: date or null

## Introduction to TableMapper Queries

If we don't configure `TableMapper` at all, objects provided to the queries are those passed to Kysely, and objects returned by Kysely are those provided to the client. Consider:

```ts
const db = new Kysely<Database>({ ... });
const table = new TableMapper(db, 'users');
users = await table.select().returnAll();
user = await table.select().returnOne();
// user is { id: 123, name: 'Jane Smith', birthyear: 1970, modified: Date('1/2/2023') }
```

The first selection returns all rows from the 'users' table, representing each row as an object with fields `id`, `name`, and `birthyear`. The second selection returns just the first user. If we want to return specific rows, we can supply a filter:

```ts
users = await table.select({ name: 'Jane Smith' }).returnAll();
users = await table.select('name', '=', 'Jane Smith').returnAll();
users = await table
  .select({
    name: 'Jane Smith',
    birthyear: 1970,
  })
  .returnAll();
users = await table
  .select(({ and, cmpr }) => and([ // kysely expression
    cmpr('name', '=' 'Jane Smith'),
    cmpr('birthyear', '=', 1970),
  ]))
  .returnAll();
users = await table
  .select({
    name: ['Jane Smith', 'John Doe', 'Suzie Cue'], // any of these names
    birthyear: 1970,
  })
  .returnAll();
users = await table.select(sql`name = ${targetName}`).returnAll();
```

We can insert, update, and delete rows as follows:

```ts
await table.insert().run(user1);
await table.insert().run([user2, user3, user4]);
await table.delete({ name: 'John Doe' }).run();
deleteCount = await table.delete({ name: 'John Doe' }).returnCount();

// changes email in rows having name 'Jane Smith'
await table.update({ name: 'Jane Smith' }).run({ email: 'js2@abc.def' });
updateCount = await table
  .update({ name: 'Jane Smith' })
  .returnCount({ email: 'js2@abc.def' });
```

However, if we want to return the auto-incremented ID on insertion, we have to configure `TableMapper` to tell it which columns to return. Since the ID is the table's primary key, we can simply set the primary key, and `TableMapper` will return the column by default:

```ts
const table = new TableMapper(db, 'users', { keyColumns: ['id'] });
result = table.insert().returnOne(user1);
// result is { id: 315 }
result = table.insert().returnAll([user2, user3, user4]);
// result is [{ id: 316 }, { id: 317 }, { id: 318 }]
```

This also allows us to select users by ID by providing the ID alone as the query filter. The following queries are all equivalent:

```ts
user = await table.select(123).returnOne();
user = await table.select({ id: 123 }).returnOne();
user = await table.select('id', '=', 123).returnOne();
```

Tables with composite or compound keys can specify them in tuple filters:

```ts
const table = new TableMapper(db, 'line_items', {
  keyColumns: ['customer_id', 'product_id'],
});
item = await table.select([customerId, productId]).returnOne();
```

You may want to return more than the assigned ID on insertion, or you may want to return columns that automatically update on each update query. You can control which values are returned from update and insert queries as follows (regardless of whether you provide `keyColumns`):

```ts
const table = new TableMapper(db, 'users', {
  keyColumns: ['id'],
  returnColumns: ['id', 'modified'],
});
result = table.insert().returnOne(user1);
// result is { id: 123, modified: Date("1/2/2023") }
result = table
  .update({ name: 'Jane Smith' })
  .returnOne({ email: 'js2@abc.def' });
// result is { id: 542, modified: Date("2/4/2023") }
```

Notice that insert and update return the same columns whenever they return columns. If you call `run()` on insert or either `run()` or `returnCount()` on update, the query requests no return columns from the database, and none are returned to the caller.

Set `returnColumns` to `['*']` to return all columns. Its default value is `[]`, returning no columns.

You can also control which columns are returned from selections:

```ts
const table = new TableMapper(db, 'users', {
  keyColumns: ['id'],
  returnColumns: ['id', 'modified'],
  selectedColumns: ['id', 'name', 'birthyear'], // excludes 'modified'
});
user = await table.select(123).returnOne();
// user is { id: 123, name: 'Jane Doe', birthyear: 1970 }
```

The default value of `selectedColumns` is `['*']`, selecting all columns.

Unlike traditional ORMs, you can create multiple table mappers for any given database table, each configured differently.

## Introduction to TableMapper Mapping

The query methods don't provide much (if any) value over writing pure Kysely. The real value of this utility is it's ability to centrally define how objects are mapped to and from the database. The query methods then perform these mappings automatically.

Each mapping is implemented by a custom 'transform' function. The following transform functions are available for customization:

- Transform the object provided for insertion into the columns to insert.
- Transform the columns returned from an insertion, along with the corresponding inserted object, into the object to return to the caller.
- Transform the columns returned from a selection into the object to return to the caller.
- Transform the object that supplies update values into the columns to update.
- Transform the columns returned from an update, along with the object that supplied the update values, into the object to return to the caller.
- Transform the count of the number of affected rows from the `bigint` that Kysely returns into the type required by the caller (e.g. `number` or `string`).

We'll start with an example of a table mapper that both inserts and selects objects of class `User`. `User` differs from a row of the 'users' table by virtue of splitting the name into first and last names and leaving out the modification date:

```ts
class User {
  constructor(
    readonly id: number,
    readonly firstName: string,
    readonly lastName: string,
    readonly birthyear: number
  ) {}
}
```

Suppose we also want to return the number of affected rows as a `number` instead of a `bigint`. We define the following custom table mapper:

```ts
const table = new TableMapper(db, 'users', {
  keyColumns: ['id'],
}).withTransforms({
  insertTransform: (user: User) => ({
    name: `${user.firstName} ${user.lastName}`,
    birthyear: user.birthyear,
  }),
  insertReturnTransform: (user: User, returns) =>
    new User(returns.id, user.firstName, user.lastName, user.birthyear),
  selectTransform: (row) => {
    const names = row.name.split(' ');
    return new User(row.id, names[0], names[1], row.birthyear);
  },
  countTransform: (count) => Number(count),
});
```

## License

MIT License. Copyright &copy; 2023 Joseph T. Lapp

```

```
