## ADDED Requirements

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

The store SHALL read a data file of shape `{"items": [...]}`. If the file does
not exist, then the store SHALL behave as though it held `{"items": []}` and
SHALL NOT create the file on a read. `list()` SHALL resolve to every item in
file order, and `get(id)` SHALL resolve to the item with that id or `null`.
Every item the store returns SHALL be a copy, so mutating it never changes the
store's state.

#### Scenario: Missing file reads as empty
- **WHEN** a store points at a path that does not exist and `list()` is called
- **THEN** it resolves to `[]` and the file still does not exist

#### Scenario: Unknown id reads as null
- **WHEN** `get("no-such-id")` is called
- **THEN** it resolves to `null`

#### Scenario: Returned items are copies
- **WHEN** a caller changes the `title` of an item returned by `list()` and
  calls `list()` again
- **THEN** the second result carries the original title

### Requirement: Mutations with ids and timestamps
id: store-mutations

`create({ title, done, tags })` SHALL append an item
`{id, title, done, tags, createdAt, updatedAt}` whose `id` is
`crypto.randomUUID()` and whose timestamps are the same ISO-8601 string, and
SHALL resolve to it. `update(id, patch)` SHALL copy only the `title`, `done`,
and `tags` keys present in `patch`, SHALL set `updatedAt` to the current
ISO-8601 time, SHALL leave `id` and `createdAt` unchanged, and SHALL resolve to
the updated item, or to `null` when no item has that id. `remove(id)` SHALL
delete the item and resolve to `true`, or resolve to `false` when no item has
that id. The store SHALL NOT validate field values; `src/items.js` owns
validation.

#### Scenario: Create assigns id and timestamps
- **WHEN** `create({ title: "a", done: false, tags: [] })` is called
- **THEN** the result has a UUID `id`, `createdAt` equal to `updatedAt`, both
  parse as ISO-8601 dates, and the data file holds that item

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
