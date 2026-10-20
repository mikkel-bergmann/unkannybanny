## MODIFIED Requirements

### Requirement: Card order and item moves
id: store-item-order
base: adaf7f274e46

The order of the `items` array in the data file SHALL be the card order: a
lane's cards are the items whose `columnId` names that lane, in array order.
`create` SHALL keep appending, so a new card lands at the end of its lane, and
`update` SHALL keep an item at its array position. `moveItem(id, { columnId,
before })` SHALL remove the item from the array, set its `columnId` to
`columnId` and its `updatedAt` to the current ISO-8601 time, and re-insert it
immediately before the item whose id is `before`, or at the end of the array
when `before` is `null`; it SHALL resolve to the moved item. The move SHALL run
through the same atomic, serialized write-through as every other mutation. An
existing data file SHALL need no migration: its array order is read as the
card order as it stands.

`moveItem` SHALL check every reference inside its own queued operation, against
the state it writes, in this order, and SHALL reject with an
`ItemReferenceError` (a subclass of `ItemValidationError` from `src/items.js`
whose `code` is `invalid-item`) carrying `reason` and `ref`, write nothing, and
leave the queue running:

- If `columnId` is not `null` and names no column, then reason `column` with
  message "columnId names no column: <columnId>".
- If `before` is not `null` and names no item, then reason `before-missing`
  with message "before names no item: <before>".
- If `before` equals `id`, then reason `before-self` with message "before must
  not be the moved item".
- If `before` names an item whose `columnId` differs from `columnId`, then
  reason `before-lane` with message "before names an item in another column".

Every `before-*` rejection SHALL carry `itemMissing`, `true` when no item has
`id`. When every check passes and no item has `id`, `moveItem` SHALL resolve to
`null` and leave the file unchanged.

#### Scenario: Move within a lane
- **WHEN** the store holds items `a`, `b`, `c` in column `k` and
  `moveItem(c, { columnId: k, before: a })` is called
- **THEN** it resolves to `c` and `list()` returns `c`, `a`, `b`

#### Scenario: Move across lanes to a position
- **WHEN** the store holds `a` and `b` in column `k` and `x` in column `m`, and
  `moveItem(x, { columnId: k, before: b })` is called
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

#### Scenario: A before item deleted ahead of a queued move is refused
- **WHEN** column `k` holds `a`, `x` is unassigned, and `remove(a)` then
  `moveItem(x, { columnId: k, before: a })` are started without awaiting
  between them
- **THEN** the move rejects with reason `before-missing` and the data file
  text equals the text right after the remove

#### Scenario: A before item moved to another lane ahead of a queued move is refused
- **WHEN** column `k` holds `a`, `x` is unassigned, and
  `moveItem(a, { columnId: m, before: null })` then
  `moveItem(x, { columnId: k, before: a })` are started without awaiting
- **THEN** the second rejects with reason `before-lane` and `x` keeps
  `columnId` `null`

#### Scenario: Self, missing column, and unknown id
- **WHEN** `moveItem(a, { columnId: k, before: a })`,
  `moveItem(a, { columnId: "nope", before: null })`, and
  `moveItem("no-such-id", { columnId: null, before: a })` are called with `a`
  in column `k`
- **THEN** they reject with reasons `before-self`, `column`, and
  `before-lane` with `itemMissing` `true`, and the data file is unchanged
