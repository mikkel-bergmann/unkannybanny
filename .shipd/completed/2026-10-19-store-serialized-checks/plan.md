# store-serialized-checks
Status: verified
Planned-at: c154df5fca39a31a53c7ea6fc6ca7cff4143fb97
Gated-hash: 1fa6e0fd17b9

## Idea

Move the column and `before` reference checks for item create, patch, and move
inside the store's serialized write, so they hold against the state the write
changes.

### Motivation

A board user or script that deletes a column, or moves a card, while another
client creates, patches, or moves an item can leave that item pointing at a
removed column or placed next to a card in another lane, because the routes
and `banny move` check references in one queued read and write in a later one.
The reviewer raised this as finding 2 on PR #23 (https://github.com/mikkel-bergmann/unkannybanny/pull/23)
and both agents deferred it to one follow-up covering all three writes.

### Details

- `src/items.js`: add `ItemReferenceError`, a subclass of
  `ItemValidationError` carrying a `reason` and a `ref`.
- `src/store.js`: `create`, `update`, and `moveItem` check `columnId` and
  `before` against their own in-queue state and reject with
  `ItemReferenceError` before any write.
- `src/routes/items.js`: drop `requireColumn` and the move route's
  pre-reads; the existing error handler already maps the subclass to
  "400 invalid-item" with the same message.
- `bin/banny.js`: `banny move` drops its pre-reads and maps the store's
  reasons to today's exit codes and messages.
- Tests: deterministic interleaving tests in `test/store.test.js`,
  `test/items.test.js`, and `test/cli.test.js`; two existing store tests
  switch from made-up column ids to real columns.

Affected capabilities: `json-store`, `items-api`, `banny-cli` (modified).
No new dependency, no data migration.

### Non-goals

- No change to any status code, error code, message, exit code, or check
  precedence a client sees today, other than the race closing.
- No change to the board page, the columns API, or column mutations.
- No repair of items that already hold a dangling `columnId` from an outside
  edit; only the checks on new writes move.

## Implementation

- **Typed error in `src/items.js`.** `class ItemReferenceError extends
  ItemValidationError` with `constructor(reason, ref, message)`, setting
  `name = "ItemReferenceError"`, `reason`, and `ref`; `code` stays
  `invalid-item` through the parent. Reasons and messages, each identical to
  today's route text:
  - `column` — "columnId names no column: <id>"
  - `before-missing` — "before names no item: <id>"
  - `before-self` — "before must not be the moved item"
  - `before-lane` — "before must be in the target column"
  The store imports it from `src/items.js` (no import cycle: `src/items.js`
  imports nothing). Rejected: a store-owned error with a string `code` — the
  route handler and the CLI already branch on `instanceof
  ItemValidationError`, so a subclass needs no new mapping in the routes.
  Rejected: plain `ItemValidationError` — the CLI could not tell a missing
  column (exit 4) from a wrong lane (exit 3) without parsing messages.
- **Checks run inside `run()`.** A private `checkColumn(columnId)` in
  `createStore` throws `column` when `columnId` is neither `null` nor
  `undefined` and no entry of `columns` has that id. Thrown inside the queued
  operation, it rejects that call only: nothing is committed, and `queue`
  already swallows the rejection so later operations run.
  - `create`: `checkColumn(columnId)` first.
  - `update`: when `"columnId" in patch`, `checkColumn(patch.columnId)`
    **before** the item lookup, keeping today's PATCH precedence (an unknown
    column answers 400 even for an unknown item id).
  - `moveItem`: item lookup first (`null` when absent, today's 404 and exit 4
    precedence), then `checkColumn(columnId)`, then, when `before` is not
    `null`/`undefined`: find it in `items` (`before-missing`), compare with
    `id` (`before-self`), compare `target.columnId !== columnId`
    (`before-lane`), in that order, matching both callers today. The splice
    then always finds `before`; the "names no other item appends" fallback
    is gone.
- **Routes rely on the store.** Delete `requireColumn` and its two calls, and
  in the move route delete the `store.get` pre-reads and the `before` block,
  leaving `validateItemMove`, `store.moveItem`, and the `null`-is-404 line.
  The router's error handler is unchanged.
- **CLI maps reasons.** `banny move` keeps its arity checks, then calls
  `store.moveItem(id, { columnId, before })` in a `try`: reason `column` →
  `NotFoundError("no column with id <columnId>")`, `before-missing` →
  `NotFoundError("no item with id <before>")`, anything else rethrown
  (`before-self`/`before-lane` exit 3 through the existing
  `ItemValidationError` branch). It no longer calls `validateItemMove`: its
  inputs are always a string or `null`, and keeping the call would turn
  today's exit 4 for an empty column id into exit 3. The import of
  `validateItemMove` is removed; `ItemReferenceError` is imported.
- **Deterministic interleaving.** The store queue runs in call order, so
  starting `removeColumn` and then `moveItem` without awaiting between them
  fixes the order with no timers. Route and CLI tests wrap the store as
  `{ ...store, moveItem }`, where the wrapper first starts
  `store.removeColumn(id)` and then returns `store.moveItem(...)`; before
  this change those requests pass their pre-checks and write a dangling
  `columnId`, after it they are refused.

Risk: a direct store caller that relied on `moveItem`, `create`, or `update`
accepting an unknown column id now gets a rejection; the only callers are the
routes, the CLI, and `test/store.test.js`, whose two affected tests this
change updates.

## Readiness attestation

### Problem and motivation

Reference checks run in a separate queued read from the write they guard, so
a concurrent column delete or card move can slip between them.

Evidence:

- `src/routes/items.js:18-23` `requireColumn` reads with `store.getColumn`,
  then lines 35-36 and 48-49 write in a later operation.
- `src/routes/items.js:56-66` and `bin/banny.js:184-197` read item, column,
  and `before` in separate operations before `store.moveItem`.
- PR #23 room: reviewer-b finding 6259598900; author-a and reviewer-b agreed
  to defer it to one change covering create, PATCH, and move.

### Scope and non-goals

The store, the items router, `banny move`, and their tests change; no
client-visible code, message, or precedence changes.

Evidence:

- In scope: `src/store.js:89-129`, `src/items.js`, `src/routes/items.js`,
  `bin/banny.js:173-201`.
- Out of scope: `src/routes/columns.js`, `public/index.html`, and the
  column methods at `src/store.js:136-182`.

### Affected capabilities and files

Three capabilities change: `json-store` takes the checks, `items-api` and
`banny-cli` delegate to it.

Evidence:

- `json-store`: `store-mutations` (base 66b6475e7527) and `store-item-order`
  (base adaf7f274e46) modified; `store-reference-checks` added.
- `items-api`: `items-move` (base d28c9e368bdc) modified; `items-routes`
  text stays true and is not edited.
- `banny-cli`: `cli-columns` (base 535100feb02f) modified.
- Files: `src/items.js`, `src/store.js`, `src/routes/items.js`,
  `bin/banny.js`, `test/store.test.js:258-277` (made-up ids "col-k" and
  "col-m"), `test/items.test.js`, `test/cli.test.js`.
- Runnable premise: `node --test` passes 142 of 142 at c154df5;
  `node bin/banny.js --help` exits 0 and lists the `move` usage with
  `--before`.
- Runnable premise: `main(argv, { stdout, stderr, store })` in
  `bin/banny.js:204-207` and `createApp({ store })` in `src/app.js` accept an
  injected store, which the wrapper tests use.

### No open task-shaping decision

Every decision is settled by investigation and the request's no-behaviour-change
rule; none remain.

Evidence:

- Error shape (subclass with `reason`): settled by investigation of the
  handlers in `src/routes/items.js:84` and `bin/banny.js:248`.
- Check precedence per write: settled by today's route and CLI order and
  `test/items.test.js` "POST /items/:id/move answers 404 and 415".
- Dropping `validateItemMove` from the CLI: settled by the no-change rule
  (empty column id keeps exit 4).
- Test method (queue-order interleaving and store wrappers): settled by the
  store's call-order queue in `src/store.js:43-50`.
