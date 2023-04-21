# kysely-params

Flexible Kysely-based utility for mapping between tables and objects

** CURRENTY UNDER DEVELOPMENT. NOT READY FOR USE. **

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

- **id**: auto-incrementing integer, primary key
- **name**: text
- **birth_year**: integer
- **modified**: date, maintained by a database trigger

## Introduction to TableMapper Queries

If we don't configure `TableMapper` at all, objects provided to the queries are those passed to Kysely, and objects returned by Kysely are those provided to the client. Consider:

```ts
const db = new Kysely<Database>({ ... });
const table = new TableMapper(db, 'users');
users = await table.select().returnAll();
user = await table.select().returnOne();
// user is { id: 123, name: 'Jane Smith', birth_year: 1970, modified: Date('1/2/2023') }
```

The first selection returns all rows from the 'users' table, representing each row as an object with fields `id`, `name`, and `birth_year`. The second selection returns just the first user. If we want to return specific rows, we can supply a filter:

```ts
users = await table.select({ name: 'Jane Smith' }).returnAll();
users = await table.select('name', '=', 'Jane Smith').returnAll();
users = await table
  .select({
    name: 'Jane Smith',
    birth_year: 1970,
  })
  .returnAll();
users = await table
  .select(({ and, cmpr }) => and([ // kysely expression
    cmpr('name', '=' 'Jane Smith'),
    cmpr('birth_year', '=', 1970),
  ]))
  .returnAll();
users = await table
  .select({
    name: ['Jane Smith', 'John Doe', 'Suzie Cue'], // any of these names
    birth_year: 1970,
  })
  .returnAll();
users = await table.select(sql`name = ${targetName}`).returnAll();
```

Call `modify()` to refine the underlying Kysely query builder:

```ts
users = await table
  .select({ name: 'Jane Smith' })
  .modify((qb) => qb.orderBy('birth_year', 'desc'))
  .returnAll();
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

However, if we want to return the auto-incremented ID on insertion, we have to configure `TableMapper` to tell it which columns to return. Since the ID is the table's primary key, we can simply assign this primary key, and `TableMapper` will return the column by default:

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
user = await table.select([123]).returnOne(); // a tuple key
user = await table.select({ id: 123 }).returnOne();
user = await table.select('id', '=', 123).returnOne(); // kysely binary op
```

Tables with composite or compound keys can specify them as tuples (in brackets):

```ts
const table = new TableMapper(db, 'line_items', {
  keyColumns: ['customer_id', 'product_id'],
});
item = await table.select([customerId, productId]).returnOne(); // notice the brackets
```

You may want to return more than the assigned ID on insertion, or you may want to return columns that automatically update on each update query. You can control which values are returned from update and insert queries as follows (regardless of whether you provide `keyColumns`):

```ts
const table = new TableMapper(db, 'users', {
  keyColumns: ['id'],
  insertReturnColumns: ['id', 'modified'],
  updateReturnColumns: ['modified'],
});
result = table.insert().returnOne(user1);
// result is { id: 123, modified: Date("1/2/2023") }
result = table
  .update({ name: 'Jane Smith' })
  .returnOne({ email: 'js2@abc.def' });
// result is { modified: Date("1/2/2023") }
```

If you call `run()` on insert or either `run()` or `returnCount()` on update, the query requests no return columns from the database, and none are returned to the caller.

Set return columns to `['*']` to return all columns or `[]` to return no columns. By default, inserts return the key columns and updates return no columns.

You can also control which columns selections return, and you can specify aliases for any returned columns:

```ts
const table = new TableMapper(db, 'users', {
  keyColumns: ['id'],
  selectedColumns: ['id', 'name', 'birth_year as birthYear'],
  insertReturnColumns: ['id', 'modified'],
  updateReturnColumns: ['modified'],
});
user = await table.select(123).returnOne();
// user is { id: 123, name: 'Jane Doe', birthYear: 1970 }
```

`selectedColumns` defaults to `['*']`, which selects all columns. The utility does not provide a way to specify the selected columns on a per-query basis, but if you're using the utlity, it's likely because you want all selections returning the same kind of object.

Unlike traditional ORMs, you can create multiple table mappers for any given database table, each configured differently as best suits the usage. For example, you could have different table mappers selecting different columns, returning different objects.

## Introduction to TableMapper Mapping

The query methods don't provide much (if any) value over writing pure Kysely. The real value of this utility is it's ability to centrally define how objects are mapped to and from database tables. The query methods then perform these mappings automatically.

Each mapping is implemented by a custom 'transform' function. The following transform functions are available for customization:

- `insertTransform` &mdash; Transform the object provided for insertion into the columns to insert.
- `insertReturnTransform` &mdash; Transform the columns returned from an insertion, along with the corresponding inserted object, into the object to return to the caller.
- `selectTransform` &mdash; Transform the columns returned from a selection into the object to return to the caller.
- `updateTransform` &mdash; Transform the object that supplies update values into the columns to update.
- `udpateReturnTransform` &mdash; Transform the columns returned from an update, along with the object that supplied the update values, into the object to return to the caller.
- `countTransform` &mdash; Transform the count of the number of affected rows from the `bigint` that Kysely returns into the type required by the caller (e.g. `number` or `string`).

We'll start with an example of a table mapper that both inserts and selects objects of class `User`. `User` differs from a row of the 'users' table by virtue of splitting the name into first and last names and leaving out the modification date:

```ts
class User {
  constructor(
    readonly id: number,
    readonly firstName: string,
    readonly lastName: string,
    readonly birthYear: number
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
    birth_year: user.birthYear,
  }),
  insertReturnTransform: (user: User, returns) =>
    new User(returns.id, user.firstName, user.lastName, user.birthYear),
  selectTransform: (row) => {
    const names = row.name.split(' ');
    return new User(row.id, names[0], names[1], row.birth_year);
  },
  countTransform: (count) => Number(count),
});
```

TBD: infers and enforces types
TBD: examples of use

This table mapper creates a new `User` from an inserted `User` and the auto-incremented return ID. It could instead have set the ID in the inserted `User` and returned that object, or it could have simply returned the ID instead of an object. Choose any behavior you want. For example, the following returns just the ID to the caller on insertion:

```ts
const table = new TableMapper(db, 'users', {
  keyColumns: ['id'],
}).withTransforms({
  // ...
  insertReturnTransform: (_user: User, returns) => returns.id,
});
id = await table.insert().returnOne(user);
// id is 123 (the generated auto-increment integer)
```

TBD: mention `.columns()`

## License

MIT License. Copyright &copy; 2023 Joseph T. Lapp
