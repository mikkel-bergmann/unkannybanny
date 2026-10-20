## ADDED Requirements

### Requirement: Card order and item moves
id: store-item-order

The order of the `items` array in the data file SHALL be the card order: a
lane's cards are the items whose `columnId` names that lane, in array order.
`create` SHALL keep appending, so a new card lands at the end of its lane, and
`update` SHALL keep an item at its array position. `moveItem(id, { columnId,
before })` SHALL remove the item from the array, set its `columnId` to
`columnId` and its `updatedAt` to the current ISO-8601 time, and re-insert it
immediately before the item whose id is `before`, or at the end of the array
when `before` is `null` or names no other item; it SHALL resolve to the moved
item, or to `null` and leave the file unchanged when no item has `id`. The move
SHALL run through the same atomic, serialized write-through as every other
mutation. An existing data file SHALL need no migration: its array order is
read as the card order as it stands.

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
