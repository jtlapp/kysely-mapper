# kysely-mapper

Flexible Kysely-based utility for mapping between tables and objects

**CURRENTY UNDER DEVELOPMENT. NOT READY FOR USE.**

## Overview

This utility helps eliminate the boilerplate associated with mapping between database tables and objects.

Unconfigured, the utility does no mapping and only serves as a shorthand for accessing tables using column names as fields. When configured, it provides nearly complete control over how objects map to and from individual tables. Mappings can be tailored per table and can vary in degree of ORM functionality.

All queries are based on [Kysely](https://github.com/kysely-org/kysely) and give you access to the underlying query builders for further modification. The utility also supports compiling its object-mapping queries, parameterized for variation from run to run.

## Installation

Install both Kysely and this package with your preferred dependency manager:

```
npm install kysely kysely-mapper

yarn add kysely kysely-mapper

pnpm add kysely kysely-mapper
```

## Introduction

This package provides three classes for mapping tables: `AbstractTableMapper`, `TableMapper` and `EntireRowTransforms`. `AbstractTableMapper` is a base class for constructing your own kinds of table mappers. `TableMapper` is a generic mapping utility that implements `AbstractTableMapper` and should suffice for most of your needs. `EntireRowTransforms` provides default mappings for a table mapper whose queries input and output entire rows of the underlying table.

Most of the examples in this document assume the following 'users' table:

| Users Table Column | Column Type                            |
| ------------------ | -------------------------------------- |
| id                 | auto-incrementing integer, primary key |
| name               | text                                   |
| birth_year         | integer                                |
| modified           | date, maintained by a database trigger |

We first configure a table mapper by specifying key columns, selected columns, insert return columns, and update return columns, where they differ from the defaults. We also specify any needed transformations between objects and table row columns. For example:

```ts
const table = new TableMapper(db, 'users', {
  keyColumns: ['id'],
  insertReturnColumns: ['id', 'modified'],
  updateReturnColumns: ['modified'],
}).withTransforms({
  insertTransform: (source: User) => ({
    name: `${source.firstName} ${source.lastName}`,
    birth_year: source.birthYear,
  }),
  insertReturnTransform: (source: User, returns) =>
    new User(
      returns.id,
      source.firstName,
      source.lastName,
      source.birthYear,
      returns.modified
    ),
  selectTransform: (row) => {
    const names = row.name.split(' ');
    return new User(row.id, names[0], names[1], row.birth_year, row.modified);
  },
});
```

We then call methods on the table mapper for creating queries. Table mappers support insert, update, select, and delete queries. Except for insert, the queries take filters that generate 'where' clauses for constraining the query.

After creating a query, we can call methods on the query to execute it. The names of these methods are consistent across queries: `run`, `returnCount`, `returnOne`, and `returnAll`. The particular methods available and the parameters they take vary by kind of query.

Here are some examples of creating and executing queries:

```ts
await table.insert().run(userToInsert1);
user = await table.insert().returnOne(userToInsert2);

user = await table.select(userID).returnOne();
users = await table.select('name', '=', 'John Doe').returnAll();
users = await table
  .select({ name: 'Jane Smith' })
  .modify((qb) => qb.orderBy('birth_year', 'desc'))
  .returnAll();

await table.update({ name: 'Joe Mac' }).run({ name: 'Joseph Mack' });
updateCount = await table
  .update({ name: 'Jane Smith' })
  .returnCount({ email: 'js2@abc.def' });

await table.delete({ name: 'John Doe' }).run();
deleteCount = await table.delete({ name: 'John Doe' }).returnCount();
```

Additional methods are available for directly modifying the underlying query builder (`modify`), for creating compiling queries (`compile`), and for parameterizing compiling queries (`parameterize`), the latter of which is a method on table mappers.

The following sections explain everything in detail.

## Issuing Queries

Let's begin by looking at how we query instances of `TableMapper`. If we don't configure `TableMapper`, no mapping occurs: objects provided to the queries are passed directly to Kysely, and objects returned by Kysely are passed directly back to the caller. Consider:

```ts
const db = new Kysely<Database>({ ... });
const table = new TableMapper(db, 'users');
users = await table.select().returnAll();
user = await table.select().returnOne();
// user is { id: 123, name: 'Jane Smith', birth_year: 1970, modified: Date('1/2/2023') }
```

The first selection returns all rows from the 'users' table, representing each row as an object with fields `id`, `name`, and `birth_year`. The second selection returns just the first user. If we want to return specific rows, we can supply a query filter:

```ts
users = await table.select().returnAll(); // returns all users

users = await table.select({ name: 'Jane Smith' }).returnAll();
users = await table.select('name', '=', 'Jane Smith').returnAll();
users = await table.select(sql`name = ${findName}`).returnAll();

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
// result is { id: 123, modified: Date("4/18/2023") }
result = table
  .update({ name: 'Jane Smith' })
  .returnOne({ email: 'js2@abc.def' });
// result is { modified: Date("4/18/2023") }
```

If you call `run()` on insert or either `run()` or `returnCount()` on update, the query requests no return columns from the database, and none are returned to the caller.

Set return columns to `['*']` to return all columns or `[]` to return no columns. By default, inserts return the key columns and updates return no columns.

You can also control the columns that selections return, and you can specify aliases for any returned columns:

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

## Mapping Queries

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
    firstName: string,
    lastName: string,
    birthYear: number,
    readonly modified?: Date
  ) {}
}
```

We define the following custom table mapper:

```ts
const table = new TableMapper(db, 'users', {
  keyColumns: ['id'],
  selectedColumns: ['id', 'name', 'birth_year as birthYear, modified'],
  insertReturnColumns: ['id', 'modified'],
  updateReturnColumns: ['modified'],
}).withTransforms({
  insertTransform: (source: User) => ({
    name: `${source.firstName} ${source.lastName}`,
    birth_year: source.birthYear,
  }),
  insertReturnTransform: (source: User, returns) =>
    new User(
      returns.id,
      source.firstName,
      source.lastName,
      source.birthYear,
      returns.modified
    ),
  selectTransform: (row) => {
    const names = row.name.split(' ');
    return new User(row.id, names[0], names[1], row.birthYear, row.modified);
  },
});
```

This table mapper creates a new `User` from an inserted `User` and the auto-incremented return ID, and it has selections return instances of `User`:

```ts
user = await table.insert().returnOne(new User(0, 'Jane', 'Smith', 1970));
// user is User {
//   id: 123,
//   firstName: 'Jane',
//   lastName: 'Smith',
//   birthYear: 1970,
//   modified: Date("4/21/2023")
// }
user = await table.select(user.id).returnOne();
// user is User {
//   id: 123,
//   firstName: 'Jane',
//   lastName: 'Smith',
//   birthYear: 1970,
//   modified: Date("4/21/2023")
// }
```

The table mapper infers the types of the inputs and outputs of each transform, allowing the query methods to enforce these types on their inputs and outputs, as appropriate.

We could instead have implemented a table mapper that set the new ID in the inserted `User` object and returned that object, or we could have simply returned the new ID instead of an object. You can choose any behavior you want. For example, the following returns just the new ID to the caller after insertion:

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

Returning to the original implementation, suppose we also want to update rows from provided `User` instances, return `User` instances updated with the latest modification date, and return the number of affected rows as a `number` instead of as a `bigint`. We now have the following table mapper:

```ts
const table = new TableMapper(db, 'users', {
  keyColumns: ['id'],
  selectedColumns: ['id', 'name', 'birth_year as birthYear, modified'],
  insertReturnColumns: ['id', 'modified'],
  updateReturnColumns: ['modified'],
}).withTransforms({
  insertTransform: (source: User) => ({
    name: `${source.firstName} ${source.lastName}`,
    birth_year: source.birthYear,
  }),
  insertReturnTransform: (source: User, returns) =>
    new User(
      returns.id,
      source.firstName,
      source.lastName,
      source.birthYear,
      returns.modified
    ),
  selectTransform: (row) => {
    const names = row.name.split(' ');
    return new User(row.id, names[0], names[1], row.birthYear, row.modified);
  },
  updateTransform: (source: User) => ({
    name: `${source.firstName} ${source.lastName}`,
    birth_year: source.birthYear,
  }),
  updateReturnTransform: (source: User, returns) =>
    new User(
      source.id,
      source.firstName,
      source.lastName,
      source.birthYear,
      returns.modified
    ),
  countTransform: (count) => Number(count),
});
```

`insertTransform` and `updateTransform` are identical in this implementation and could have been a shared function. Now we can update and delete as follows:

```ts
user = await table.insert().returnOne(new User(0, 'Jane', 'Smith', 1970));
user.firstName = 'Janice';
user = await table.update(user.id).returnOne(user);
// user is User {
//   id: 123,
//   firstName: 'Janice',
//   lastName: 'Smith',
//   birthYear: 1970,
//   modified: Date("4/21/2023")
// }
deleteCount = await table.delete('name', 'like', '%Smith').returnCount();
// deleteCount has type number
```

For performance reasons, you may not want to update all columns on every update query, preferring to instead update only the columns that need to change. You can accomplish this by calling the `columns()` method to specify the columns to update:

```ts
user = await table.insert().returnOne(new User(0, 'Jane', 'Smith', 1970));
user.firstName = 'Janice';
user = await table.update(user.id).columns(['name']).returnOne(user);
```

Mind you, `updateTransform` will still run in its entirety, but only the specified subset of its return values will be used in the update. The `columns()` method is also available on insertion for fine control over when to use database defaults, with the same caveat applying to `insertTransform`.

For greater flexibility, we could have had the update source be a union of types:

```ts
updateTransform: (source: User | Updateable<Database['users']>) =>
  source instanceof User
    ? {
        name: `${source.firstName} ${source.lastName}`,
        birth_year: source.birthYear,
      }
    : source;
```

Now we can also update as follows:

```ts
user = await table.insert().returnOne(new User(0, 'Jane', 'Smith', 1970));
user = await table.update(user.id).returnOne({ name: 'Janice Smith' });
await table.update({ name: 'Joe Mac' }).run({ name: 'Joseph Mack' });
```

## Compiling Queries

Table mappers are also able to produce parameterized, compiling queries that compile the underlying Kysely query builder on the first execution and use this compilation for subsequent executions. You can provide parameters for values that can vary from execution to execution, particularly in query filters that define "where" clauses. Inserted and updating objects are always fully parameterized, so these too can vary from execution to execution.

Any mapped query can be compiled by calling its `compile()` method, and the resulting compilation can be called via the methods available to the uncompiled query. However, you must call `columns()` on insert and update queries prior to compilation:

```ts
const compilingInsert = table
  .insert()
  .columns(['name', 'birth_year']) // columns to insert
  .compile();
await compilingInsert.run(userToInsert);

const compilingUpdate = table
  .update({ name: 'Joe Mac' }) // columns to update
  .columns(['name'])
  .compile();
user = await compilingUpdate.returnOne({}, { name: 'Joseph Mack' });

const compilingSelect = table.select({ name: 'Joseph Mack' }).compile();
users = await compilingSelect.returnAll({});

const compilingDelete = table.delete({ name: 'Joseph Mack' }).compile();
count = await compilingDelete.returnCount({});
```

We have to call `columns()` on insertions and updates to tell the utility what columns to set, because Kysely normally gets this information from the values object itself. The utility compiles the query prior to receiving the values object, so that the values object can vary by execution within the same compiled query. This requires the columns to be known in advance of executing the query.

Except for insertions, the methods of compiling queries all take an additional argument, which is `{}` in each case above. This is an object that provides parameter values. When we create a compiling query by calling `compile()`, we are not parameterizing anything but the values for inserting or updating. The second argument of these methods provides these values. Given that there are no additional parameters to provide, the parameters object will be empty.

If we want to parameterize the query filter, we call `parameterize()` on the table mapper instead of calling `compile()` on the query. We also provide `parameterize()` with a type parameter that defines the available parameters as the properties of an object. The following examples all use the same type parameters, `Params`:

```ts
interface Params {
  findName: string;
}

const compilingUpdate = table.parameterize<Params>(({ mapper, param }) =>
  mapper.update({ name: param('findName') }).columns(['name'])
);
user = await compilingUpdate.returnOne(
  { findName: 'Joe Mac' },
  { name: 'Joseph Mack' }
);

const compilingSelect = table.parameterize<Params>(({ mapper, param }) =>
  mapper.select({ name: param('findName') })
);
users = await compilingSelect.returnAll({ findName: 'Joe Mac' });

const compilingDelete = table.parameterize<Params>(({ mapper, param }) =>
  mapper.delete({ name: param('findName') })
);
count = await compilingDelete.returnCount({ findName: 'Joe Mac' });
```

No example is shown for insertion, because not having query filters, there is nothing further to parameterize.

In these examples, the parameter is called `findName` to make it clear that parameters are names you make up, rather than having to be column names. However, we can use column names as parameter names if we want, because the parameters used to insert values are in their own namespace.

We hand `parameterize()` a factory function that returns a compilable query. To make this query, the function receives a reference to the table mapper (`mapper`) and a `param()` function. Construct the query from `mapper`, replacing the filter right-hand-values you wish to parameterize with calls to `param()`. Provide `param()` with the parameter name, which must be a property of the parameters type (here, `Params`). The parameter must have a type in the type parameter that is permitted for the right-hand-value it provides. The factory function must must call `columns()` on update queries before returning the query.

`parameterize()` returns a compiling query that can be repeatedly called with different parameters (unless it's an insertion) and different values (for insertions and updates). The compiling query compiles on its first execution, caches the compilation, discards the underlying Kysely query builder to free memory, and uses the cached compilation on subsequent executions. (Insertions and updates may actually cache two compilations on the first execution &mdash; one for queries that return values and one for queries that don't).

Kysely queries are fast, and the present utility doesn't do much additional work on top of Kysely, so you are not likely to need compiling queries to improve query speed. However, query builders do use memory, increase garbage collection, and consume clock cycles that could be used elsewhere. Compiling queries allow you to minimize resource usage for the kinds of applications that can benefit. (Note that the [kysely-params](https://github.com/jtlapp/kysely-params) utility that the present utility relies on lets you compile and parameterize arbitrary Kysely queries.)

Compilation adds a bit of complication to your queries. It's best to implement the application without compilation until you find that you need it: you may discover that you never needed the additional complication. The compilation facility exists to help you feel comfortable using the tool for any kind of application.

## Usage in Repository Classes

We typically want to use table mappers in repository classes that represent database tables with application-specific interfaces. We also typically want to create instances of these classes with dependency injection, passing in dependencies rather than hard-coding them. Table mappers depend on instances of the `Kysely` class and present a complication for dependency injection. This section documents a simple solution to this complication.

The `TableMapper` class has many type parameters, and we would rather not have to specify them. When we create a table mapper, passing in its various column settings and transforms, TypeScript can infer all of the type parameters from these settings and transforms. However, we require an instance of `Kysely` to create the table mapper. If we want to define the table mapper prior to creating it, such as to make it a property of a repository class, and if we only receive the `Kysely` instance at repository construction, we may be inclined to specify all of the type parameters in our definition.

A better solution is to provide a method on the repository class that returns a table mapper and then define the table mapper property as the return type of this method. This provides the best of both worlds: we infer all of the type parameters and have a property based on the inferred types. Here is an example:

```ts
export class UserRepo {
  readonly #table: ReturnType<UserRepo['getMapper']>;

  constructor(readonly db: Kysely<Database>) {
    this.#table = this.getMapper(db);
  }

  async getByID(id: number): Promise<User | null> {
    return this.#table.select(id).returnOne();
  }

  async deleteById(id: number): Promise<boolean> {
    return this.#table.delete(id).run();
  }

  async store(user: User): Promise<User | null> {
    return user.id
      ? (await this.#table.update(user.id).run(user))
        ? user
        : null
      : this.#table.insert().returnOne(user);
  }

  private getMapper(db: Kysely<Database>) {
    return new TableMapper(db, 'users', {
      keyColumns: ['id'],
    }).withTransforms({
      insertTransform: (source: User) => {
        const insertion = { ...source } as any;
        delete insertion['id'];
        return insertion;
      },
      insertReturnTransform: (source: User, returns) =>
        new User({ ...source, id: returns.id }),
      selectTransform: (row) => new User(row),
    });
  }
}
```

We can do something similar when using compiling queries. There's no need to keep the table mapper around if all queries are compiling, as we only need the compiled queries:

```ts
export class UserRepo {
  readonly #queries: ReturnType<UserRepo['getQueries']>;

  constructor(readonly db: Kysely<Database>) {
    this.#queries = this.getQueries(db);
  }

  async deleteById(id: number): Promise<boolean> {
    return this.#queries.deleteByID.run({ id });
  }

  async getByID(id: number): Promise<User | null> {
    return this.#queries.selectByID.returnOne({ id });
  }

  async store(user: User): Promise<User | null> {
    return user.id
      ? (await this.#queries.updateByID.run({ id: user.id }, user))
        ? user
        : null
      : this.#queries.insert.returnOne(user);
  }

  private getQueries(db: Kysely<Database>) {
    const table = new TableMapper(db, 'users', {
      keyColumns: ['id'],
    }).withTransforms({
      insertTransform: (user: User) => {
        const insertion = { ...user } as any;
        delete insertion['id'];
        return insertion;
      },
      insertReturnTransform: (user: User, returns) =>
        new User({ ...user, id: returns.id }),
      selectTransform: (row) => new User(row),
    });

    return {
      // prettier-ignore
      deleteByID: table.parameterize<{ id: number }>(
        ({ mapper, param }) => mapper.delete(param('id'))
      ),
      // prettier-ignore
      selectByID: table.parameterize<{ id: number }>(
        ({ mapper, param }) => mapper.select(param('id'))
      ),
      // prettier-ignore
      updateByID: table.parameterize<{ id: number }>(
        ({ mapper, param }) =>
          mapper.update(param('id')).columns(['name', 'birth_year'])
      ),
      insert: table.insert().columns(['name', 'birth_year']).compile(),
    };
  }
}
```

## EntireRowTransforms

`EntireRowTransforms` is a class that provides transforms for defining a table mapper whose queries all receive and return entire rows of the table. Use it when you want to read and write entire rows but also respect the expected insert and update return columns. The class exists merely for your convenience.

Here is how you create a table mapper that uses these transforms:

```ts
const KEY_COLUMNS = ['id'];

const table = new TableMapper(db, 'users', {
  keyColumns: KEY_COLUMNS,
  insertReturnColumns: ['id', 'modified'],
  updateReturnColumns: ['modified'],
}).withTransforms(new EntireRowTransforms(KEY_COLUMNS));
```

The transforms are only compatible with with table mappers that select all columns, as the above does because `selectedColumns` defaults to `['*']`.

The resulting table mapper has these properties:

- Upon insertion, key columns with falsy values are removed from the query; when you want the table to generate a key, set the key value to `null`, 0, or an empty string `""`. You can further restrict inserted columns by calling `columns`()` on the query.
- The row returned from an insertion is the row provided for insertion merged with the columns returned from the insertion.
- Select queries return entire rows.
- The caller provides an entire row when updating, setting all columns, unless you restrict columns by calling `columns()` on the query.
- The row returned from an update is the row provided with the update merged with the columns returned from the update.
- Counts of the number of affected rows have type `number`.

## Quick Reference

Here are some quick-reference charts that should help make this utility easy to learn. Hopefully, the charts also reveal both the simplicity and flexibility of the solution.

`TableMapper` has the following constructor and methods:

<!-- prettier-ignore -->
| Method of TableMapper | Description |
| --- | --- |
| `constructor(settings)` | Constructs a `TableMapper` from the provided settings, which characterize columns. |
| `withTransforms(transforms)` | Returns a new `TableMapper` that combines the settings of the current table mapper with the provided transforms. |
| `insert()` | Returns an insert query.  |
| `update(filter?)` | Returns an update query that updates rows matching the optionally provided filter. |
| `select(filter?)` | Returns a select query that selects rows matching the optionally provided filter. |
| `delete(filter?)` | Returns a delete query that deletes rows matching the optionally provided filter. |
| `ref(column)` | Returns a reference to a column with a dynamically-generated name. (Shorthand for `db.dynamic.ref(column)`.) |
| `parameterize<Params>(`<br/>`({ mapper, param }) =>`<br/>`new query)` | Returns a compiling query with a parameterized filter. Its argument is a factory method that returns a parameterized, compilable query. |

The `TableMapper` constructor takes a settings object, all of whose properties are optional:

<!-- prettier-ignore -->
| TableMapper Setting | Description |
| --- | --- |
| `keyColumns` | Tuple of the columns that make up the table's key. Defaults to `[]`, indicating that no columns are keys. |
| `selectedColumns` | Array of columns to return from selection queries. Defaults to `[*]`, selecting all columns. May contain aliases. |
| `insertReturnColumns` | Array of columns to return from insert queries that return columns. `['*']` returns all columns; `[]` returns none. May specify aliases. Defaults to `keyColumns`. |
| `updateReturnColumns` | Array of columns to return from update queries that return columns. `['*']` returns all columns; `[]` returns none and is the default. May specify aliases. |

The `tableMapper.withTransforms` method takes a transforms object, all of whose properties are optional:

<!-- prettier-ignore -->
| TableMapper Transform | Description |
| --- | --- |
| `insertTransform` | (source-object) => table columns object<br/> Transforms the source object into the table column-values to insert. The default assumes the source object contains only table columns. |
| `insertReturnTransform` | (source-object, returns) => insert return<br/> Transforms the source object and the returned column-values into the value to return from the insert query. The default returns an object containing the returned columns, unless there are no `insertReturnColumns`, in which case the return type is `void`. |
| `updateTransform` | (source-object) => table columns object<br/> Transforms the source object into the table column-values to update. The default assumes the source object contains only table columns. |
| `updateReturnTransform` | (source-object, returns) => update return<br/> Transforms the source object and the returned column-values into the value to return from the udpate query. The default returns an object containing the returned columns, unless there are no `updateReturnColumns`, in which case the return type is `void`. |
| `selectTransform` | (selected-row) => selected object<br/> Transforms a selected row of column-values into the object to return from the select query. The default returns the selected row. |
| `countTransform` | (count: bigint) => return count<br/> Transforms the number of affected rows into the value to return from `returnCount` methods. Returns a `bigint` by default. |

The argument to `update()`, `select()`, and `delete()` is an optional query filter. The following query filters are available:

<!-- prettier-ignore -->
| Query Filter | Description |
| :---: | --- |
| *none* | All rows match when there is no filter argument. |
| `string` or `number` | Value of the row's primary key, matching rows with this key value. Only available if the row has a single-column primary key. |
| [key1, key2, ...] | Tuple of the row's single or compound key, matching rows with this key combination. Only available if the row has at least one key column. |
| `object` | Object of fields, matching rows whose columns match the values of the object's properties. Non-array property values are compared by equality, while array properties match via `where ... in ...` expressions. `{}` matches all rows.
| left-hand-side, operation, right-hand-side | Providing three arguments matches via a Kysely binary operation (e.g. `'total', '>', '100'`). |
| kysely where expression factory | Function that builds a Kysely where expression. (e.g. `({ any, cmpr j}) => any(cmpr('status', '!=', 'down'), cmpr('service', '=', 'messaging')`). |
| kysely `sql` expression | A Kysely `sql` expression (e.g. ``sql`status = ${targetStatus}``).

The queries that `TableFilter` methods return all have similar methods, as this chart summarizes:

<!-- prettier-ignore -->
| Method of Query | insert() | update(filter?) | select(filter?) | delete(filter?) |
|  --- |  --- |  --- |  --- |  --- |
| `modify` | ((kysely-QB) =><br/> new kysely QB) => new insert query | ((kysely-QB) =><br/> new kysely QB) => new update query | ((kysely-QB) =><br/> new kysely QB) => select query | ((kysely-QB) =><br/> new kysely QB) => delete query |
| `columns` | (columns-to-insert array) =><br/> compilable insert query | (columns-to-update array) =><br/> compilable update query | N/A | N/A |
| `run` | (values) =><br/> true (always) | (values) =><br/> boolean (whether any updated) | N/A | () =><br/> boolean (whether any deleted) |
| `returnCount` | N/A | (values) =><br/> return count | N/A | () =><br/> return count |
| `returnOne` | (values) =><br/> insert return | (values) =><br/> update return | () =><br/> selected object | N/A |
| `returnAll` | (values[]) =><br/> (insert return)[] | (values) =><br/> (update return)[] | () => (<br/>selected object)[] | N/A |
| `compile` | after calling `columns`: () =><br/> compiling insert query | after calling `columns`: () =><br/> compiling update query | () =><br/> compiling select query | () =><br/> compiling delete query |

`modify` returns an instance of the kind of query on which it was called. All select and delete queries are compilable, but you must call `columns` to get a compilable version of an insert or update query.

`tableMapper.parameterize()` and `query.compile()` both return compiling queries, which compile on their first execution. These queries have similar methods, as shown in this chart:

<!-- prettier-ignore -->
| Method of Compiling Query | Compiling Insert Query | Compiling Update Query | Compiling Select Query | Compiling Delete Query |
|  --- |  --- |  --- |  --- |  --- |
| `run` | (values) =><br/> true (always) | (params, values) =><br/> boolean  (whether any updated) | N/A | (params) =><br/> boolean (whether any deleted) |
| `returnCount` | N/A | (params, values) =><br/> return count | N/A | (params) =><br/> return count |
| `returnOne` | (values) =><br/> insert return | (params, values) =><br/> update return | (params) =><br/> selected object | N/A |
| `returnAll` | (values[]) =><br/> (insert return)[] | (params, values) =><br/> (update return)[] | (params) =><br/> (selected object)[] | N/A |

## API Reference

TBD

## License

MIT License. Copyright &copy; 2023 Joseph T. Lapp
