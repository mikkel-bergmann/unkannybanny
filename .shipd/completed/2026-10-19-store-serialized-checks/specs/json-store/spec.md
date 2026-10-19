## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Mutations with ids and timestamps
id: store-mutations
base: 66b6475e7527

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

### Requirement: Card order and item moves
id: store-item-order
base: adaf7f274e46

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
