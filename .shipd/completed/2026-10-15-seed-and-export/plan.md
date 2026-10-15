# seed-and-export
Status: verified
Epic: unkannybanny

## Idea

Add `banny seed` to fill an empty board with sample items, `banny export` to
print the whole store, and `GET /export` to download it as a JSON file.

### Motivation

A new user faces an empty board with nothing to try the page, the API, or the
filters on. Nobody can back up or move the board's data except by finding and
copying the data file by hand.

### Details

- `bin/banny.js`: `seed` and `export` entries in the `commands` table, and a
  `SAMPLE_ITEMS` constant.
- `src/routes/export.js`: default `(store) => Router` serving `GET /export`,
  and a named `serializeExport(items)`.
- `src/app.js`: one `app.use(exportRouter(store))` line.
- `test/seed.test.js` and `test/export.test.js` (new); `test/cli.test.js`
  is untouched.

Affected capabilities: `seed-and-export` (added). Builds on banny-cli
(`commands`, `main`, `formatItem`, `UsageError`), json-store (`createStore`),
and items-api (`validateNewItem`). No new dependency.

### Non-goals

- No import or restore verb, and no route that writes the store.
- No `--force`, `--count`, or `--output` flags; use shell redirection to save
  an export.
- No bulk-replace method on the store, and no change to `src/store.js` or
  `src/items.js`.
- No board-page button (board-page owns `public/index.html`) and no README
  change.

## Implementation

- **Verbs are table entries.** `seed` and `export` are added after `remove` in
  banny-cli's `commands`, each `{ usage, options: {}, run }`. `main`, help,
  parsing, error mapping, and exit codes are reused unchanged. Each `run`
  throws banny-cli's `UsageError` when `args.length > 0`. Rejected: a separate
  `bin/seed.js`, outside the epic's fixed layout.
- **Seed (Q1, Q2).** `SAMPLE_ITEMS` is a frozen array of five inputs in
  `bin/banny.js` (listed in the `seed-verb` requirement). `run` calls
  `store.list()`; when it is non-empty it returns
  `{ json: { items: [] }, text: "store is not empty; nothing seeded" }`.
  Otherwise it maps every sample through `validateNewItem` first, so a bad
  sample creates nothing, then awaits `store.create` for each in order and
  returns `{ json: { items }, text: items.map(formatItem).join("\n") }`.
  Rejected: a fixture file (`data/` is gitignored, and the layout gives seed
  no file of its own).
- **Export document (Q3).** `serializeExport(items)` in `src/routes/export.js`
  returns `JSON.stringify({ items }, null, 2) + "\n"`, the same text
  json-store writes. That makes a CLI export, a downloaded export, and the
  data file the same format. The CLI's `export` returns
  `{ json: { items }, text: serializeExport(items).trimEnd() }`, and `main`
  adds back the final newline. `bin/banny.js` imports the helper from
  `../src/routes/export.js`, so the format has one owner.
- **Route (Q4).** `GET /export` calls `store.list()`, then
  `res.attachment("banny-export.json")`, `res.type("application/json")`, and
  `res.send(serializeExport(items))`. The handler is wrapped so a rejection
  goes to `next(err)`. json-store's `store-corrupt` error has no status, so
  request-logging's error handler answers it `500 internal`.
- **Mount.** In `src/app.js`, `app.use(exportRouter(store))` goes on the line
  after `app.use(tagsRouter(store))`, or after `app.use(itemsRouter(store))`
  when tags-and-search has not merged yet. It always goes above any static,
  `noRoute`, or `errorHandler` line, per the epic's fixed order.
- **Tests.** Both new files follow banny-cli's test style: `spawnSync` of
  `bin/banny.js` with `BANNY_DATA` set to a `mkdtemp` file. The route tests
  use `createApp` on port 0 with global `fetch`. banny-cli's verb-table test
  checks only the first four keys, so no existing test breaks; the six-verb
  table is asserted in `test/seed.test.js`.

Risk: seed's emptiness check and its creates are separate store calls, so a
write landing in between can make seed add samples to a non-empty store. That
is harmless for sample data and is accepted.

## Questions and answers

### Q1: What does `banny seed` do on a non-empty store?
- **Question:** Options: (1) create nothing, exit `0`, print
  `store is not empty; nothing seeded` (`{"items":[]}` under `--json`);
  (2) always append the samples; (3) refuse unless `--force`.
  Recommendation: (1).
- **Verdict:** INSUFFICIENT
- **Answered by:** USER
- **Answer:** Option 1: seed is safe to rerun and never duplicates samples.
- **Queued:** q-banny-seed-nonempty-store

### Q2: Which sample items does seed create, and where are they defined?
- **Question:** Options: (1) five fixed items in a `SAMPLE_ITEMS` constant in
  `bin/banny.js`, four open and one done, tagged from `kitchen`, `shop`,
  `garden`, `docs`, one untagged, all validated before any is created;
  (2) a JSON fixture file; (3) a `--count` flag making numbered placeholders.
  Recommendation: (1).
- **Verdict:** INSUFFICIENT
- **Answered by:** USER
- **Answer:** Option 1: the samples exercise done marks, tags, and the tag
  filter, and they need no file outside the fixed layout.
- **Queued:** q-seed-sample-items

### Q3: What document do `banny export` and `GET /export` produce?
- **Question:** Options: (1) the data file's own form,
  `JSON.stringify({ items }, null, 2) + "\n"`, byte-identical from both
  through `serializeExport` in `src/routes/export.js`, with CLI `--json`
  compact; (2) compact `{"items":[...]}` everywhere; (3) a bare array.
  Recommendation: (1).
- **Verdict:** INSUFFICIENT
- **Answered by:** USER
- **Answer:** Option 1: an export can be used directly as a `BANNY_DATA`
  file.
- **Queued:** q-export-document-format

### Q4: What download headers does `GET /export` send?
- **Question:** Options: (1) `200`, `application/json; charset=utf-8`,
  `Content-Disposition: attachment; filename="banny-export.json"`; (2) the
  same with a date-stamped filename; (3) no `Content-Disposition`.
  Recommendation: (1).
- **Verdict:** INSUFFICIENT
- **Answered by:** USER
- **Answer:** Option 1: the browser treats it as a download, and the fixed
  name keeps the tests deterministic.
- **Queued:** q-export-download-headers

## Readiness attestation

### Problem and motivation

There is no sample data to try the board on, and no supported way to get the
data out of it.

Evidence:

- Epic `unkannybanny` Changes row seed-and-export; the Introduction promises
  "seed and export verbs for moving data in and out".

### Scope and non-goals

Two CLI verbs, one route, and their tests. Import, the board button, and store
changes are left out.

Evidence:

- Epic Design: "Seed and export sit on the CLI and the API"; the mount order
  lists `export` after tags. board-page owns `public/index.html`.
- json-store Non-goals leave any bulk method to a later `MODIFIED` delta; this
  plan needs none.

### Affected capabilities and files

One new capability and five files, built on four unmerged members'
interfaces.

Evidence:

- Capability `seed-and-export` (added); the library is empty.
- New: `src/routes/export.js`, `test/seed.test.js`, `test/export.test.js`.
- Edited: `bin/banny.js` (banny-cli tasks 2.1 to 2.3) and `src/app.js`
  (app-scaffold, items-api 4.1, tags-and-search mount).
- Interfaces: json-store Q1 and Q2, items-api Q3, banny-cli Q1 and Q5,
  request-logging Q4.
- Runnable premise: an Express 4.22.3 probe of `res.attachment` and
  `res.type` answered `200`, `application/json; charset=utf-8`, and
  `attachment; filename="banny-export.json"`, with the pretty body intact;
  `HEAD` answered `200` with the same disposition.
- Runnable premise: `npm test` in the worktree exited 0 (1 pass).

### No open task-shaping decision

Every decision is settled.

Evidence:

- Q1 to Q4: planner defaults; the oracle queued each one.
- Verb shape, mount position, error mapping, and test style: settled by
  investigation of the epic and the earlier members' plans.
- Personal memory store: none exists.
