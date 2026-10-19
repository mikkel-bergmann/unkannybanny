# json-store

### Requirement: Store factory and data file location
id: store-factory

The system SHALL export from `src/store.js` a function `createStore({ path })`
that returns a store bound to one JSON data file. Where `path` is omitted, the
store SHALL use `process.env.BANNY_DATA`, and where that is unset, the store
SHALL use `data/banny.json`; a relative path SHALL resolve against the process
working directory. The repository SHALL ignore `data/` in `.gitignore`.

#### Scenario: Explicit path wins
- **WHEN** a test calls `createStore({ path: "<tmp>/banny.json" })` and creates
  an item
- **THEN** the item is written to `<tmp>/banny.json` and nothing is written under
  `data/`

#### Scenario: BANNY_DATA sets the default path
- **WHEN** `BANNY_DATA` names a file in a temp directory and `createStore()` is
  called with no `path`, then an item is created
- **THEN** the item is written to the file `BANNY_DATA` names

#### Scenario: Data directory is ignored
- **WHEN** `git check-ignore data/banny.json` runs in the repository
- **THEN** it exits 0

### Requirement: Reading the data file
id: store-read

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

### Requirement: Mutations with ids and timestamps
id: store-mutations

`create({ title, done, tags, columnId })` SHALL append an item
`{id, title, done, tags, columnId, createdAt, updatedAt}` whose `id` is
`crypto.randomUUID()`, whose `columnId` defaults to `null`, and whose
timestamps are the same ISO-8601 string, and SHALL resolve to it.
`update(id, patch)` SHALL copy only the `title`, `done`, `tags`, and
`columnId` keys present in `patch`, SHALL set `updatedAt` to the current
ISO-8601 time, SHALL leave `id` and `createdAt` unchanged, and SHALL resolve to
the updated item, or to `null` when no item has that id. `remove(id)` SHALL
delete the item and resolve to `true`, or resolve to `false` when no item has
that id. The store SHALL NOT validate field shapes; `src/items.js` owns shape
validation, and the store makes only the reference checks of
`store-reference-checks`.

#### Scenario: Create assigns id and timestamps
- **WHEN** `create({ title: "a", done: false, tags: [] })` is called
- **THEN** the result has a UUID `id`, `columnId` `null`, `createdAt` equal to
  `updatedAt`, both parse as ISO-8601 dates, and the data file holds that item

#### Scenario: Update ignores id and createdAt
- **WHEN** `update(id, { done: true, id: "x", createdAt: "y" })` is called on an
  existing item
- **THEN** the result has `done: true`, the original `id` and `createdAt`, and a
  `updatedAt` no earlier than `createdAt`

#### Scenario: Unknown id on mutation
- **WHEN** `update("no-such-id", { done: true })` and `remove("no-such-id")` are
  called
- **THEN** they resolve to `null` and `false` and the data file is unchanged

### Requirement: Atomic, serialized write-through
id: store-atomic-write

When a mutation succeeds, the store SHALL write the whole state to a uniquely
named temp file in the data file's directory and rename it over the data file,
creating the directory if it is missing. The store SHALL run every operation,
reads included, through one queue in call order, so overlapping mutations never
lose an update and an older snapshot never lands after a newer one. If a write
fails, then the store SHALL remove its temp file and reject the mutation.

#### Scenario: Overlapping mutations all land
- **WHEN** 50 `create` calls are started without awaiting each other and then
  awaited together
- **THEN** the data file holds 50 items with distinct ids and `list()` returns
  all 50

#### Scenario: No temp files remain
- **WHEN** a sequence of create, update, and remove calls has settled
- **THEN** the data file's directory holds only the data file

### Requirement: Reload on outside writes
id: store-reload

Before every operation, the store SHALL compare the data file's mtime and size
with those it last loaded or wrote, and SHALL reload the file when either
differs, so a write made by another process is seen.

#### Scenario: Outside write is seen
- **WHEN** a store has listed one item and another writer replaces the file
  with a different `{"items": [...]}` of a different size
- **THEN** the store's next `list()` returns the other writer's items

### Requirement: Corrupt data file is refused
id: store-corrupt

If the data file exists but is not valid JSON or has no `items` array, then
every operation SHALL reject with an Error whose `code` is `store-corrupt` and
whose message names the path, and the store SHALL NOT overwrite the file.

#### Scenario: Corrupt file rejects and survives
- **WHEN** the data file holds `not json` and `create(...)` is called
- **THEN** the call rejects with `code` `store-corrupt` and the file still holds
  `not json`

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

### Requirement: Card order and item moves
id: store-item-order

The order of the `items` array in the data file SHALL be the card order: a
lane's cards are the items whose `columnId` names that lane, in array order.
`create` SHALL keep appending, so a new card lands at the end of its lane, and
`update` SHALL keep an item at its array position. `moveItem(id, { columnId,
before })` SHALL, once the checks of `store-reference-checks` pass, remove the
item from the array, set its `columnId` to `columnId` and its `updatedAt` to
the current ISO-8601 time, and re-insert it immediately before the item whose
id is `before`, or at the end of the array when `before` is `null`; it SHALL
resolve to the moved item, or to `null` and leave the file unchanged when no
item has `id`. The move SHALL run through the same atomic, serialized
write-through as every other mutation. An existing data file SHALL need no
migration: its array order is read as the card order as it stands.

#### Scenario: Move within a lane
- **WHEN** the store holds column `k` and items `a`, `b`, `c` in it, and
  `moveItem(c, { columnId: k, before: a })` is called
- **THEN** it resolves to `c` and `list()` returns `c`, `a`, `b`

#### Scenario: Move across lanes to a position
- **WHEN** the store holds columns `k` and `m`, `a` and `b` in `k`, and `x` in
  `m`, and `moveItem(x, { columnId: k, before: b })` is called
- **THEN** `list()` returns `a`, `x`, `b` and `x` has `columnId` `k`

#### Scenario: Move to the end of a lane
- **WHEN** the store holds `a` and `b` with `columnId` `null` and
  `moveItem(a, { columnId: null, before: null })` is called
- **THEN** `list()` returns `b`, `a`

#### Scenario: Unknown item
- **WHEN** `moveItem("no-such-id", { columnId: null, before: null })` is called
- **THEN** it resolves to `null` and the data file is unchanged

#### Scenario: Existing file keeps its order
- **WHEN** a data file written before this change holds items `a`, `b`, `c` in
  one column and a store lists them
- **THEN** `list()` returns `a`, `b`, `c` and nothing is rewritten

### Requirement: Reference checks inside the serialized write
id: store-reference-checks

The system SHALL export from `src/items.js` a class `ItemReferenceError`, a
subclass of `ItemValidationError` whose `code` is `invalid-item`, carrying a
`reason` of `column`, `before-missing`, `before-self`, or `before-lane` and a
`ref` naming the offending id. The store SHALL make its reference checks inside
the same queued operation that writes, against the state that operation
changes, and if a check fails, then the operation SHALL reject with
`ItemReferenceError`, SHALL NOT change the data file, and SHALL leave the queue
running later operations.

- `create` SHALL reject with reason `column` and the message
  "columnId names no column: <id>" when `columnId` is not `null` and names no
  column.
- `update` SHALL, when `patch` holds `columnId`, make the same check before it
  looks up the item, so an unknown column rejects even for an unknown id.
- `moveItem` SHALL first resolve to `null` when no item has `id`, then reject
  with reason `column` as above, then, when `before` is not `null`, reject with
  reason `before-missing` and the message "before names no item: <id>" when no
  item has that id, with reason `before-self` and the message "before must not
  be the moved item" when it is `id`, and with reason `before-lane` and the
  message "before must be in the target column" when that item's `columnId`
  differs from `columnId`, in that order.

#### Scenario: A column removed ahead of a queued move
- **WHEN** the store holds column `c` and unassigned item `i`, and
  `removeColumn(c)` then `moveItem(i, { columnId: c, before: null })` are
  started without awaiting between them
- **THEN** the remove resolves to `true`, the move rejects with an
  `ItemReferenceError` whose `reason` is `column` and `code` is
  `invalid-item`, and `get(i)` has `columnId` `null`

#### Scenario: A column removed ahead of a queued create or update
- **WHEN** `removeColumn(c)` is started and then, without awaiting,
  `create({ title: "a", done: false, tags: [], columnId: c })`, and in a
  second run `update(i, { columnId: c })`
- **THEN** each write rejects with reason `column`, `list()` holds no new
  item, and `i` keeps its previous `columnId`

#### Scenario: The before item leaves the lane ahead of a queued move
- **WHEN** columns `k` and `m` exist, `a` is in `k`, `x` is unassigned, and
  `moveItem(a, { columnId: m, before: null })` then
  `moveItem(x, { columnId: k, before: a })` are started without awaiting
  between them
- **THEN** the first resolves, the second rejects with reason `before-lane`,
  and `x` still has `columnId` `null`

#### Scenario: Missing and self before items
- **WHEN** `moveItem(x, { columnId: k, before: "no-such-id" })` and
  `moveItem(a, { columnId: k, before: a })` are called
- **THEN** they reject with reasons `before-missing` and `before-self` and the
  data file is unchanged

#### Scenario: Precedence of unknown ids
- **WHEN** `moveItem("no-such-id", { columnId: "nope", before: null })` and
  `update("no-such-id", { columnId: "nope" })` are called
- **THEN** the move resolves to `null` and the update rejects with reason
  `column`
