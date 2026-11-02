# kanban-columns
Status: verified
Planned-at: 4b50850faf94a0d96e1028e397ef3d7408846dd0
Gated-hash: 46098e7917e9

## Idea

Give the banny board named columns that can be created, renamed, reordered, and
that hold items, turning the flat list into a kanban board.

### Motivation

The board renders every item in one flat list, so a user cannot group work into
stages or see which stage a card is in; tags filter the list but carry no order
and no name of their own. A user who wants lanes they can name and arrange
(for example Backlog, Doing, Done) and drag cards between has no way to express
that.

### Details

- `src/columns.js`: `validateNewColumn`, `validateColumnPatch`, and
  `ColumnValidationError` (`code: invalid-column`).
- `src/routes/columns.js`: `GET /columns`, `POST /columns`,
  `PATCH /columns/:id`, `DELETE /columns/:id`, `PUT /columns/order`.
- `src/store.js`: the file becomes `{"items":[...], "columns":[...]}` (columns
  optional), with `listColumns`, `getColumn`, `createColumn`, `updateColumn`,
  `removeColumn`, and `reorderColumns`.
- `src/items.js`: an item gains an optional `columnId` (`null` = unassigned).
- `src/routes/items.js`: create and update reject a `columnId` naming no column.
- `src/routes/export.js`: the export document carries the columns, so a
  `BANNY_DATA` file and an export stay byte-identical.
- `public/index.html`: lanes in column order, an add-column form, inline rename,
  reorder and remove controls, and drag-and-drop of cards between lanes.
- `bin/banny.js`: the `columns`, `column add|rename|move|remove`, and `move`
  verbs, and an `export` that includes the columns.

Affected capabilities: `columns-api` (added); `json-store`, `items-api`,
`board-page`, `banny-cli`, `seed-and-export` (modified). Impact: no new
dependency; an existing data file with no `columns` key reads as a board with no
columns, and a board with no columns still exports as `{"items": [...]}`.

### Non-goals

- No `?column=` filter on `GET /items`, and no coupling of `done` to a column:
  `done` stays an independent flag.
- No ordering of cards within a column, and no persistence of card position.
- No change to tags or the tag filter, and no per-user or permissioned columns.
- No migration of existing data files: a missing `columns` key reads as `[]`
  and existing items read as unassigned.

## Implementation

- **Columns are first-class, ordered by array position (Q2).** A column is
  `{id, name, createdAt, updatedAt}` with `id` from `crypto.randomUUID()`, and
  the order of the `columns` array is the display order — the same store-order
  concept items already use — so reordering rewrites the array rather than
  maintaining position integers. Rejected: an explicit `position` integer, which
  needs renumbering and can drift.
- **An item points at a column (Q1).** An item gains `columnId`, a UUID string
  or `null`, where `null` is unassigned; `done` is untouched and stays
  independent, so a card can be done in any lane. Rejected: a column replacing
  `done` (loses the flag the board and CLI already use); columns derived from
  tags (tags are many-per-item and unordered, so they cannot be lanes).
- **Deleting a column unassigns its cards (Q3).** `removeColumn` removes the
  column and sets `columnId: null` on every item that referenced it, in one
  atomic write. Rejected: refusing while non-empty (a stuck board); deleting the
  cards (data loss).
- **Existence is enforced where the reference is written.** `src/items.js`
  validates only the type (`null` or a non-empty string); `src/routes/items.js`
  checks the named column through `store.getColumn` and answers `400`
  `invalid-item` when it is absent, so the API never stores a dangling
  `columnId`.
- **Order writes are whole-list and validated.** `PUT /columns/order` reads
  `{"ids":[...]}`; the store applies it only when `ids` is a permutation of the
  current column ids (same length, every id present, no duplicates) and resolves
  to the reordered columns, otherwise to `null` and the route answers `400`
  `invalid-column`. The whole-list write keeps the operation atomic under the
  store's queue.
- **The board groups client-side (Q4).** The page still fetches `GET /items` and
  `GET /tags`, and now also `GET /columns`; it renders one lane per column in
  order into `id="item-list"`, plus a trailing `Unassigned` lane for items whose
  `columnId` is `null` or names no column. Cards are HTML5-draggable; dropping a
  card on a lane sends `PATCH /items/<id>` `{"columnId": <lane id or null>}`.
  Column create is a form; rename is an inline text input; reorder is `◀`/`▶`
  buttons on the lane header (via `PUT /columns/order`); remove is a `✕` button.
  The buttons keep every operation keyboard-reachable. The single-inline-script,
  no-`innerHTML`, and no-external-resource rules still hold.
- **CLI mirrors the API (Q4).** `banny columns` lists lanes in order; `banny
  column add <name...>`, `banny column rename <id> <name...>`, `banny column
  move <id> <position>` (1-based), `banny column remove <id>`, and `banny move
  <item-id> <column-id>` with `--none` to unassign. The verbs join the existing
  `commands` table; exit codes reuse `usage: 2`, `invalid-item: 3`,
  `not-found: 4`.
- **Export carries the columns.** The store writes the `columns` key only when
  at least one column exists, and `serializeExport(items, columns)` mirrors that
  rule, so a board with no columns still writes and exports the original
  `{"items": [...]}` shape and a board with columns round-trips both. Rejected:
  leaving export items-only — it would break the verified "export equals the
  data file" contract and silently drop columns on import.
- **Validation shape mirrors items.** `src/columns.js` exports
  `validateNewColumn`, `validateColumnPatch`, and `ColumnValidationError`
  (`code: invalid-column`); a name is a trimmed string of 1 to 100 characters
  and is required on create.
- **Router mount.** `src/app.js` gains `app.use(columnsRouter(store))` directly
  after the tags router and before the export router.

Risk: the board page gains a lot of interaction. The single-script and
no-`innerHTML` rules keep it testable, and rename, reorder, and move all go
through the same API the HTTP tests exercise.

## Questions and answers

### Q1: How does an item relate to a column, and does done stay?
- **Question:** Options: (1) an item gains an optional `columnId` (`null` =
  Unassigned) and `done` stays; (2) a column replaces `done`; (3) columns are
  derived from tags. Recommendation: (1).
- **Verdict:** INSUFFICIENT
- **Answered by:** USER
- **Answer:** Option 1 — an item carries `columnId` (`null` = unassigned) and
  `done` stays a separate flag, so a card can be done in any lane.
- **Queued:** q-kanban-item-column-link

### Q2: How is column order stored?
- **Question:** Options: (1) array order in the store, reorder rewrites the
  array; (2) an explicit `position` integer per column. Recommendation: (1).
- **Verdict:** INSUFFICIENT
- **Answered by:** USER
- **Answer:** Option 1 — the `columns` array's order is the display order,
  matching the store's existing file-order concept; reordering rewrites the
  array.
- **Queued:** q-kanban-column-order

### Q3: What happens when a column holding items is deleted?
- **Question:** Options: (1) unassign its items (`columnId` becomes `null`);
  (2) refuse while non-empty; (3) delete its items too. Recommendation: (1).
- **Verdict:** INSUFFICIENT
- **Answered by:** USER
- **Answer:** Option 1 — deleting a column removes it and unassigns its cards in
  one atomic write; no card is lost.
- **Queued:** q-kanban-column-delete

### Q4: Which surfaces ship, and how does the board reorder and move?
- **Question:** Options: (1) API + board drag + CLI; (2) API + board buttons
  only; (3) API + CLI only. Recommendation: (1).
- **Verdict:** INSUFFICIENT
- **Answered by:** USER
- **Answer:** Option 1 — the columns API, a board with drag-and-drop plus
  keyboard buttons, and CLI verbs all ship.
- **Queued:** q-kanban-surfaces-interaction

## Readiness attestation

### Problem and motivation

A user cannot group board work into named, ordered stages or see which stage a
card is in; every item renders in one flat list.

Evidence:

- `public/index.html` renders one `#item-list` with no grouping.
- Capability `board-page` requirement `board-list-filter`: items render "in API
  order" with no lane concept.
- Capability `json-store` requirement `store-read`: the data file is
  `{"items": [...]}` with no column concept anywhere.

### Scope and non-goals

A column model in the store, a columns API, a `columnId` on items, a kanban
board, and CLI verbs; card ordering, a `?column=` filter, and per-user columns
stay out.

Evidence:

- In scope: `src/store.js`, `src/columns.js`, `src/routes/columns.js`,
  `src/items.js`, `src/routes/items.js`, `src/routes/export.js`, `src/app.js`,
  `public/index.html`, `bin/banny.js`.
- Out of scope: tags and the tag filter (`src/routes/tags.js` is not edited);
  no card position is stored.

### Affected capabilities and files

Six capabilities are affected: a new columns API plus five modified
capabilities, because a column is stored, served, referenced by an item,
rendered by the board, driven by the CLI, and carried by an export.

Evidence:

- Capability `columns-api` (added): `src/columns.js`, `src/routes/columns.js`.
- Capability `json-store` (modified): `store-read` (base 6ec6aac8dbdb),
  `store-columns` added; `src/store.js`.
- Capability `items-api` (modified): `item-validation` (base e75d7f0fdf25),
  `items-routes` (base 3b7778b9b7ea); `src/items.js`, `src/routes/items.js`.
- Capability `board-page` (modified): `board-page-markup` (base 336d87de7282),
  `board-list-filter` (base 6d69dc6ded8b), `board-columns` added;
  `public/index.html`.
- Capability `banny-cli` (modified): `cli-columns` added; `bin/banny.js`.
- Capability `seed-and-export` (modified): `export-document` (base
  083774de88a1), `export-verb` (base ba92a2c48f41), `export-route` (base
  3183f6d91ccd); `src/routes/export.js`.
- Runnable premise: `node bin/banny.js --help` exits 0 and lists the four
  existing verbs, confirming the dispatch reads one `commands` table.

### No open task-shaping decision

Every task-shaping decision is settled: the four product choices were answered
by the user, and the rest follow the repository's existing patterns.

Evidence:

- Item-column link, order representation, column deletion, and surfaces: settled
  by the user, Q1 through Q4.
- Router placement, error shape, validation shape, and mount order: settled by
  investigation against `app-scaffold`, `items-api`, and the epic's fixed
  layout.
