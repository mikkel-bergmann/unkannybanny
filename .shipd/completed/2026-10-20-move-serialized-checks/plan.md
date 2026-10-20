# move-serialized-checks
Status: ready
Planned-at: ef949249d51e3e795f7bf77e446f0e387c574173
Gated-hash: e64031bff344

## Idea

Move every reference check for an item move into the store's serialized
`moveItem` write, so the `before` checks hold against the state the move
changes.

### Motivation

A board user or script that deletes or moves a card while another client
drops a card before it can have that drop silently append at the end or land
in the wrong lane, because the move route and `banny move` read `before` in
one queued operation and write in a later one. The reviewer raised this on
PR 28 (https://github.com/mikkel-bergmann/unkannybanny/pull/28).

### Details

- `src/items.js`: add `ItemReferenceError`, a subclass of
  `ItemValidationError` carrying `reason`, `ref`, and `itemMissing`.
- `src/store.js`: `moveItem` checks the column and the `before` item inside
  its queued write and rejects with `ItemReferenceError` before any write;
  the shared `checkColumn` throws the subclass with reason `column`.
- `src/routes/items.js`: the move route drops its `requireColumn` call and
  its `before` pre-reads; the error handler already maps the subclass.
- `bin/banny.js`: `banny move` drops its pre-reads and maps the store's
  reasons to today's exit codes and messages.
- Tests: store-level race tests in `test/store.test.js`, wrapper race tests
  in `test/items.test.js` and `test/cli.test.js`.

Affected capabilities: `json-store`, `items-api`, `banny-cli` (modified).
No new dependency, no data migration.

### Non-goals

- No change to any status code, error code, message, exit code, or check
  precedence a client sees today, other than the race closing.
- No change to the create and PATCH routes: their `requireColumn` pre-check
  stays, and the store already re-checks the column inside those writes.
- No change to the board page, the columns API, or column mutations.

## Implementation

- **Typed error in `src/items.js`.** `class ItemReferenceError extends
  ItemValidationError` with `constructor(reason, ref, message, itemMissing =
  false)`, setting `reason`, `ref`, and `itemMissing`. It does not override
  `name`, so it stays "ItemValidationError" and the create/update rejections
  existing tests assert are unchanged; `code` stays `invalid-item`. Reasons
  and messages, each identical to today's route text:
  - `column`: "columnId names no column: <id>"
  - `before-missing`: "before names no item: <id>"
  - `before-self`: "before must not be the moved item"
  - `before-lane`: "before names an item in another column"
  Rejected: plain `ItemValidationError`, since the CLI could not tell a
  missing column or `before` (exit 4) from a wrong lane (exit 3) without
  parsing messages (prior art #24 made the same choice).
- **`moveItem` check order, inside `run()`.** `checkColumn(columnId)` first;
  then, when `before != null`: find it in `items` (`before-missing`),
  `before === id` (`before-self`), `target.columnId !== (columnId ?? null)`
  (`before-lane`); then the moved-item lookup, resolving `null` when absent.
  Every `before-*` error sets `itemMissing` to whether no item has `id`, read
  in the same queued operation. This order is exactly today's route order
  (column, then `before`, then 404). Any throw rejects that call only:
  nothing is committed, and `queue` swallows the rejection. The splice then
  always finds `before`, so the "names no other item appends" fallback goes.
- **Route relies on the store.** In `POST /items/:id/move` delete the
  `requireColumn` call and the `before` block, leaving `validateItemMove`,
  `store.moveItem`, and the `null`-is-404 line. The error handler is
  unchanged: the subclass answers "400 invalid-item" with the store message.
- **CLI maps reasons.** `banny move` keeps its arity checks, then calls
  `store.moveItem(id, { columnId, before })` in a `try`. Mapping:
  `column` gives `NotFoundError("no column with id <columnId>")`; any
  `before-*` error with `itemMissing` gives `NotFoundError("no item with id
  <id>")`, keeping today's item-before-`before` CLI precedence;
  `before-missing` gives `NotFoundError("no item with id <before>")`;
  `before-self` gives `ItemValidationError("--before must not be the moved
  item")`; `before-lane` gives `ItemValidationError("--before names an item in
  another lane")`; anything else is rethrown; `null` stays
  `NotFoundError("no item with id <id>")`. It stops calling
  `validateItemMove`: its inputs are always a string or `null`, and keeping
  the call would turn today's exit 4 for an empty column or `--before` id
  into exit 3. The `validateItemMove` import is removed.
- **Deterministic interleaving.** The store queue runs in call order, so
  starting `remove(before)` then `moveItem(...)` without awaiting between
  them fixes the order with no timers. Route and CLI tests wrap the store as
  `{ ...store, moveItem }`, where the wrapper first starts
  `store.remove(beforeId)` and then returns `store.moveItem(...)`.

Risk: a direct store caller that relied on `moveItem` appending for a missing
`before`, or accepting an unknown column for an unknown id, now gets a
rejection; the only callers are the route, the CLI, and the tests.

## Readiness attestation

### Problem and motivation

The move's `before` checks run in a separate queued read from the write they
guard, so a concurrent delete or move can slip between them.

Evidence:

- `src/routes/items.js:56-68` reads `before` with `store.get` before
  `store.moveItem`; `bin/banny.js:184-197` does the same.
- `src/store.js:127-139` `moveItem` appends when `before` is not found.

### Scope and non-goals

The store, the move route, `banny move`, and their tests change; no
client-visible code, message, exit code, or precedence changes.

Evidence:

- In scope: `src/items.js`, `src/store.js:83-139`, `src/routes/items.js:55-68`,
  `bin/banny.js:173-201`.
- Out of scope: the create and PATCH routes, `src/routes/columns.js`,
  `public/index.html`.

### Affected capabilities and files

Three capabilities change: `json-store` takes the checks, `items-api` and
`banny-cli` delegate to it.

Evidence:

- `json-store`: `store-item-order` (base adaf7f274e46) modified.
- `items-api`: `items-move` (base d28c9e368bdc) modified.
- `banny-cli`: `cli-columns` (base 535100feb02f) modified.
- Files: `src/items.js`, `src/store.js`, `src/routes/items.js`,
  `bin/banny.js`, `test/store.test.js`, `test/items.test.js`,
  `test/cli.test.js`.
- Runnable premise: `npm test` passes 140 of 140 at ef94924;
  `node bin/banny.js --help` exits 0 and lists the `move` usage with
  `--before`.

### No open task-shaping decision

Every decision is settled by investigation and the no-behaviour-change rule;
none remain.

Evidence:

- Error shape (subclass with `reason`): prior art #24 (commit 520b864) and
  the handlers in `src/routes/items.js` and `bin/banny.js` that branch on
  `instanceof ItemValidationError`.
- Check order: today's route order; CLI precedence kept through
  `itemMissing`.
- Dropping `validateItemMove` from the CLI: the no-change rule (empty ids
  keep exit 4).
