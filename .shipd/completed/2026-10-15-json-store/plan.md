# json-store
Status: verified
Epic: unkannybanny

## Idea

Add `src/store.js`, the board's one JSON-file database: a cached, reloading,
atomically written store with ids and timestamps.

### Motivation

items-api, banny-cli, and seed-and-export all read and write items, and none of
them can start until a store exists that the server and the CLI can share
safely. The epic fixes the store's file, cache, and write rules; this change
builds them.

### Details

- `src/store.js` exports `createStore({ path })`, returning async `list`,
  `get`, `create`, `update`, and `remove`.
- The store caches the file, reloads it when its mtime or size changes, and
  writes through a temp file and rename, one operation at a time.
- `.gitignore` gains `data/`.
- `test/store.test.js` covers overlapping mutations, an outside write, a
  missing file, and a corrupt file.

Affected capabilities: `json-store` (added). Impact: `src/store.js`,
`test/store.test.js`, `.gitignore`; no new dependencies (Node built-ins only).

### Non-goals

- No validation of titles, done flags, or tags; `src/items.js` (items-api) owns
  that.
- No HTTP route, CLI verb, or `createApp` wiring.
- No bulk replace or import method; seed-and-export adds one through a
  `MODIFIED` delta if it needs it.
- No file locking between processes beyond the mtime and size reload check.

## Implementation

- **Interface (Q1).** `createStore({ path } = {})` returns
  `{ path, list(), get(id), create({ title, done, tags }), update(id, patch), remove(id) }`.
  All methods are async. An unknown id resolves to `null` from `get` and
  `update` and to `false` from `remove`; nothing throws for it, so items-api
  maps it to `404 not-found` itself. Every returned item is a
  `structuredClone`. Rejected: a `Store` class (no gain over a closure) and
  module-level singletons (the epic injects the store into
  `createApp({ store })` and each test needs its own temp file).
- **Path.** `path.resolve(path ?? process.env.BANNY_DATA ?? "data/banny.json")`,
  read once at `createStore` time, relative to the working directory.
- **One queue for every operation.** Each call chains onto a single promise:
  refresh if changed, apply, persist on mutation. This makes a
  read-modify-write atomic within the process and gives read-your-writes. The
  epic asks for serialized writes; serializing reads too is what stops a
  mutation from computing on a cache another mutation is about to change.
  Rejected: queueing only the file write, which still lets two mutations read
  the same cache and lose one update.
- **Reload check.** `fs.stat` before every operation; reload when `mtimeMs` or
  `size` differs from the stat recorded after the last load or write. A
  missing file means empty items and is not created on read.
- **Atomic write.** Write `JSON.stringify({ items }, null, 2) + "\n"` to
  `<file>.<pid>.<uuid>.tmp` in the same directory (after
  `mkdir -p` on it), then `rename` over the file. On error, remove the temp
  file, restore the previous in-memory items, and reject.
- **Item shape.** `create` builds `{id, title, done, tags, createdAt, updatedAt}`
  in that key order with `crypto.randomUUID()` and one
  `new Date().toISOString()`. `update` copies only `title`, `done`, and `tags`
  from the patch and refreshes `updatedAt`. The store stores what it is given;
  validation and defaults belong to `src/items.js`.
- **Corrupt file (Q2).** A file that exists but does not parse, or has no
  `items` array, makes every operation reject with an `Error` whose `code` is
  `store-corrupt` and whose message names the path. The store never
  overwrites it. Rejected: treating it as empty (the next write destroys the
  data) and renaming it aside (silent recovery hides the fault).
- **Tests are unit tests.** The epic's test rule says member tests start the app
  on port 0. The store does not depend on the app (epic Design), so
  `test/store.test.js` calls `createStore` directly against a `mkdtemp`
  directory and never touches `data/`.

Risk: two outside writes within the filesystem's mtime resolution that leave
the size unchanged go unseen. The epic accepts the mtime-and-size check. The
outside-write test changes the size so that it stays deterministic.

## Questions and answers

### Q1: What public interface does `src/store.js` export?
- **Question:** Options: (1) a factory `createStore({ path })` returning async
  `list`, `get`, `create`, `update`, `remove`, with unknown ids resolving to
  `null`/`false` and copies returned; (2) a `Store` class with the same
  methods; (3) module-level singleton functions bound to `BANNY_DATA` at import.
  Recommendation: (1).
- **Verdict:** INSUFFICIENT
- **Answered by:** USER
- **Answer:** Option 1: the `createStore({ path })` factory. The epic injects
  the store through `createApp({ store })`, and every test needs its own store
  on a temp file.
- **Queued:** q-json-store-public-interface
- **Relied on by:** items-api, tags-and-search, banny-cli, board-page, seed-and-export

### Q2: What happens when the data file is corrupt?
- **Question:** When the data file exists but is not valid JSON or lacks an
  `items` array, options: (1) reject every operation with code `store-corrupt`
  and never overwrite the file; (2) treat it as empty, so the next mutation
  overwrites it; (3) rename it aside to `<path>.corrupt-<timestamp>` and start
  empty. Recommendation: (1).
- **Verdict:** INSUFFICIENT
- **Answered by:** USER
- **Answer:** Option 1: reject with `store-corrupt` and leave the file alone.
  Silent data loss is the worst outcome for the only database, and the error
  handler already turns an unhandled error into `500 internal`.
- **Queued:** q-unkannybanny-store-corrupt-file
- **Relied on by:** banny-cli, seed-and-export

## Readiness attestation

### Problem and motivation

Three later members need a shared, safe item store, and the epic fixes its
rules but no code exists.

Evidence:

- Epic `unkannybanny` Decision "One JSON file is the database" and the Changes
  table rows for items-api, banny-cli, and seed-and-export, all downstream of
  json-store.
- The worktree has no `src/` directory; `package.json` defines only
  `"test": "node --test"`.

### Scope and non-goals

The change covers the store module, its tests, and the `data/` ignore rule.
Validation, routes, and CLI verbs are left to other members.

Evidence:

- Epic Decision "The item shape is fixed here": `src/items.js` is the only
  validator.
- Epic Decision "Layout is fixed": a member adds files only in its own area.

### Affected capabilities and files

One new capability, `json-store`, and three files. The capability library is
empty.

Evidence:

- Capability `json-store` (added): requirements `store-factory`, `store-read`,
  `store-mutations`, `store-atomic-write`, `store-reload`, `store-corrupt`.
- Files: `src/store.js` (new), `test/store.test.js` (new), `.gitignore:1-5`.
- Runnable premise: `npm test` in the worktree, exit 0, 1 test passing, so
  `node --test` finds `test/*.test.js`.
- Runnable premise: `git check-ignore data/banny.json`, exit 1, so `data/` is not
  ignored yet and this change adds it.

### No open task-shaping decision

Every task-shaping decision is settled.

Evidence:

- Store interface: settled by the planner default, Q1 (oracle queued it).
- Corrupt-file behaviour: settled by the planner default, Q2 (oracle queued
  it).
- Queue scope, reload check, write path, and test style: settled by
  investigation against the epic's Decisions and Design.
- Personal memory store: none exists, so no preference applied.
