# kanban-drag-order
Status: verified
Planned-at: edfac5f0b963ddcc86ccf9f73b953866390d9197
Gated-hash: fe5a62cde4a9

## Idea

Let a user drag column headers to reorder lanes and drag cards to a position
within or across lanes, with card order persisted in the store.

### Motivation

Since #22 a user can move a card between lanes but cannot put it where it
belongs inside a lane, and can reorder columns only one `◀`/`▶` step at a time;
card order is not stored at all, so priority within a stage cannot be shown.

### Details

- `src/store.js`: `moveItem(id, { columnId, before })`; the `items` array
  order is the card order.
- `src/items.js`: `validateItemMove`.
- `src/routes/items.js`: `POST /items/:id/move`.
- `public/index.html`: a draggable `☰` grip per column header, card drops at a
  position, and all card drops through the move route.
- `bin/banny.js`: `banny move` places the card through `moveItem`, with
  `--before <item-id>`.

Affected capabilities: `json-store`, `items-api`, `board-page`, `banny-cli`
(modified). `seed-and-export` and `columns-api` are unchanged: export already
writes `items` in array order, so it carries card order with no edit.

### Non-goals

- No keyboard buttons for moving cards (Q3); no change to `PATCH /items/:id`,
  which keeps an item's array position.
- No new data field, no migration, and no change to the export format.
- No change to the columns API; column drag reuses `PUT /columns/order`.

## Implementation

- **Card order is array order (Q1).** A lane's cards are the items with its
  `columnId`, in `items` array order, the same rule #22 chose for columns.
  Existing files keep their order with no migration, and export and
  `GET /items` already emit that order. Rejected: a `position` integer (needs
  renumbering and a migration); a per-column `itemIds` list (duplicates
  `columnId` and needs a list for the Unassigned lane).
- **Moves are addressed by `before` (Q4).** `POST /items/:id/move` takes
  `{"columnId", "before"}`; the card lands just before `before`, or at the
  array end, which is the lane end, when `before` is `null`. It stays correct
  when a tag filter hides cards. Rejected: a lane index (wrong under a filter);
  a whole-lane order list (cannot express a cross-lane move in one write).
- **Route checks, store splices.** The route runs `validateItemMove`, the
  existing `requireColumn`, then reads `before` with `store.get` and refuses
  it with `400 invalid-item` when absent, equal to `:id`, or in another
  `columnId`; then `store.moveItem`, `404` on `null`. The store does no
  validation, per `store-mutations`; a `before` gone by commit time appends.
- **Column drag beside the buttons (Q2).** A `<span class="lane-grip">☰</span>`
  with `draggable` and a `title` sits first in each column header; the input
  stays undraggable so text selection works. Its `dragstart` sets
  `application/x-banny-column` to the column id; cards set
  `application/x-banny-item` to the item id, replacing `text/plain`. A lane's
  `drop` reads the column type and calls the existing `moveColumn(from, to)`,
  with the Unassigned lane meaning the last index. `◀`/`▶` stay as the
  keyboard path.
- **Card drops.** Each card's `drop` handler reads the item type, calls
  `stopPropagation`, and sends the move with `before` set to its own id; a
  lane's `drop` sends `before: null`. Same-card drops send nothing. A
  `dragover` calls `preventDefault` only when `event.dataTransfer.types`
  holds one of the two types. The single inline script, no `innerHTML`, and
  no external resource rules hold.
- **CLI.** `banny move` gains `--before` (string option) and calls
  `store.moveItem` instead of `store.update`; it checks the column, the item,
  and the `--before` item with `get`/`getColumn` first (exit `4`), and a
  self or other-lane `before` throws `ItemValidationError` (exit `3`).

Risk: an item with a dangling `columnId` (outside edit only) shows in
Unassigned but refuses `before` drops with `columnId: null`; the page shows
the API message and a drop on the lane still works.

## Questions and answers

### Q1: How is card order persisted?
- **Question:** Options: (1) `items` array order, a move splices; (2) a
  `position` integer per item plus a migration; (3) a per-column `itemIds`
  list. Recommendation: (1).
- **Verdict:** INSUFFICIENT
- **Answered by:** USER
- **Answer:** Option 1, array order, matching #22's column order; no
  migration, current order preserved.
- **Queued:** q-kanban-drag-order-card-persistence

### Q2: Do the column buttons stay beside drag?
- **Question:** Options: (1) keep `◀`/`▶` beside a drag grip; (2) drag plus an
  arrow-key handler; (3) drag only. Recommendation: (1).
- **Verdict:** INSUFFICIENT
- **Answered by:** USER
- **Answer:** Option 1; the buttons stay the keyboard path.
- **Queued:** q-kanban-drag-order-reorder-buttons

### Q3: Do cards get a keyboard reorder path?
- **Question:** Options: (1) no new card buttons, CLI and API as the
  non-pointer path; (2) `▲`/`▼` buttons per card. Recommendation: (1).
- **Verdict:** INSUFFICIENT
- **Answered by:** USER
- **Answer:** Option 1, to keep the change reviewable.
- **Queued:** q-kanban-drag-order-card-keyboard-path

### Q4: How does the API address a card position?
- **Question:** Options: (1) `POST /items/:id/move` with `columnId` and
  `before`; (2) a lane index; (3) a whole-lane order `PUT`.
  Recommendation: (1).
- **Verdict:** INSUFFICIENT
- **Answered by:** USER
- **Answer:** Option 1; robust under a tag-filtered board.
- **Queued:** q-kanban-drag-order-card-position-api

## Readiness attestation

### Problem and motivation

Cards cannot be placed within a lane and card order is not stored.

Evidence:

- `public/index.html` `renderLane` drop sends only `{columnId}`.
- `.shipd/completed/2026-10-18-kanban-columns/plan.md` non-goals: "No ordering
  of cards within a column".

### Scope and non-goals

Store, items route, board, and `banny move` change; export, columns API, and
PATCH stay as they are.

Evidence:

- In scope: `src/store.js`, `src/items.js`, `src/routes/items.js`,
  `public/index.html`, `bin/banny.js`.
- Out of scope: `src/routes/export.js`, `src/routes/columns.js`.

### Affected capabilities and files

Four capabilities are modified because order is stored, served, dragged, and
driven from the CLI.

Evidence:

- `json-store`: `store-item-order` added; `src/store.js`.
- `items-api`: `items-move` added; `src/items.js`, `src/routes/items.js`.
- `board-page`: `board-columns` (base 676e0baba4b9); `public/index.html`.
- `banny-cli`: `cli-columns` (base f895a8b98531); `bin/banny.js`.
- Runnable premise: `node bin/banny.js --help` exits 0 with `banny move
  <item-id> <column-id> | <item-id> --none`; `node --test` passes 129 of 129.

### No open task-shaping decision

All four product decisions carry planner defaults pending the user; the rest
follow repository patterns.

Evidence:

- Representation, buttons, card keyboard path, move addressing: PLANNER,
  Q1 to Q4.
- Validation shape, error codes, route placement, store queue use:
  investigation of `items-api`, `json-store`, `banny-cli`.
