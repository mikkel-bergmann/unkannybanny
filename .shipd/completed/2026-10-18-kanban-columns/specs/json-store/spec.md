## MODIFIED Requirements

### Requirement: Reading the data file
id: store-read
base: 6ec6aac8dbdb

The store SHALL read a data file of shape `{"items": [...], "columns": [...]}`,
where `columns` is optional and its absence reads as `[]`. If the file does not
exist, then the store SHALL behave as though it held `{"items": [], "columns":
[]}` and SHALL NOT create the file on a read. `list()` SHALL resolve to every
item in file order, `listColumns()` SHALL resolve to every column in file order,
and `get(id)` and `getColumn(id)` SHALL resolve to the item or the column with
that id, or `null`. Every item and column the store returns SHALL be a copy, so
mutating it never changes the store's state.

#### Scenario: Missing file reads as empty
- **WHEN** a store points at a path that does not exist and `list()` and
  `listColumns()` are called
- **THEN** they resolve to `[]` and `[]` and the file still does not exist

#### Scenario: A file without columns reads as an empty board
- **WHEN** the data file holds `{"items": [<one item>]}` with no `columns` key
  and `listColumns()` is called
- **THEN** it resolves to `[]` and `list()` still resolves to the one item

#### Scenario: Unknown id reads as null
- **WHEN** `get("no-such-id")` and `getColumn("no-such-id")` are called
- **THEN** each resolves to `null`

#### Scenario: Returned items are copies
- **WHEN** a caller changes the `title` of an item returned by `list()` and
  calls `list()` again
- **THEN** the second result carries the original title

## ADDED Requirements

### Requirement: Column storage and mutations
id: store-columns

`createColumn({ name })` SHALL append a column `{id, name, createdAt, updatedAt}`
whose `id` is `crypto.randomUUID()` and whose timestamps are the same ISO-8601
string, and SHALL resolve to it. `updateColumn(id, patch)` SHALL copy only the
`name` key present in `patch`, SHALL set `updatedAt` to the current ISO-8601
time, and SHALL resolve to the updated column, or to `null` when no column has
that id. `removeColumn(id)` SHALL delete the column, set `columnId` to `null` on
every item that referenced it, and resolve to `true`, or resolve to `false` when
no column has that id. `reorderColumns(ids)` SHALL, when `ids` holds exactly the
current column ids with no duplicates and no unknown id, reorder the columns to
that order and resolve to them, and otherwise SHALL resolve to `null` and leave
the columns unchanged. Every column mutation SHALL run through the same atomic,
serialized write-through as the item mutations. The store SHALL NOT validate
field values; `src/columns.js` owns validation.

#### Scenario: Create assigns id and timestamps
- **WHEN** `createColumn({ name: "Backlog" })` is called
- **THEN** the result has a UUID `id`, `createdAt` equal to `updatedAt`, both
  parse as ISO-8601 dates, and the data file holds that column

#### Scenario: Update ignores id and createdAt
- **WHEN** `updateColumn(id, { name: "Doing", id: "x" })` is called on an
  existing column
- **THEN** the result has `name: "Doing"`, the original `id` and `createdAt`,
  and an `updatedAt` no earlier than `createdAt`

#### Scenario: Remove unassigns its items
- **WHEN** the store holds column `c` and an item whose `columnId` is `c`, and
  `removeColumn(c)` is called
- **THEN** it resolves to `true`, `listColumns()` holds no `c`, and that item's
  `columnId` is `null` in `get(itemId)`

#### Scenario: Reorder rejects a non-permutation
- **WHEN** the store holds columns `a` then `b` and `reorderColumns(["a"])`,
  then `reorderColumns(["a","a"])`, are called
- **THEN** each resolves to `null` and `listColumns()` still holds `a` then `b`

#### Scenario: Reorder applies a permutation
- **WHEN** `reorderColumns(["b","a"])` is called
- **THEN** it resolves to the columns `b` then `a` and the data file holds them
  in that order
