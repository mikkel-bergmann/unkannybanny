## 1. Stats

- [x] 1.1 [req: stats-counts, stats-route] In `test/stats.test.js`, change
      `SEEDED_STATS` and the empty-store expectation to carry `columns: []` and
      `unassigned` equal to `total`. Add a `computeStats` unit test and an HTTP
      test: create columns `Backlog` then `Doing` with `store.createColumn`,
      place items with `columnId` (one in `Doing`, one in `Backlog`, one
      `null`, one with a `columnId` naming no column), and assert `columns` is
      `Backlog` then `Doing` with `{ id, name, count }`, an empty column counts
      0, and `unassigned` is 2. Run `npm test` and observe these fail.
- [x] 1.2 [req: stats-counts, stats-route] In `src/routes/stats.js`, extend
      `computeStats(items, columns = [])` to add `columns` and `unassigned`
      after `tags`, and make the route read `store.list()` and
      `store.listColumns()` together via `Promise.all`.

## 2. CLI

- [x] 2.1 [req: stats-verb] In `test/stats.test.js`, update the text
      expectation to the new lines and add a case with columns asserting
      `column <name>: <n>` lines in board order then `unassigned: <n>`; keep
      the `--json` equality test. Run `npm test` and observe the text tests fail.
- [x] 2.2 [req: stats-verb] In `bin/banny.js`, make the `stats` verb call
      `computeStats(await store.list(), await store.listColumns())` and append
      the `column <name>: <n>` and `unassigned: <n>` lines to its text. Run
      `npm test` and observe everything passes.

## Token usage breakdown

| Tool | Calls | Output tokens |
| --- | --- | --- |
| Bash | 45 | 14.4k |
| Edit | 7 | 4.4k |
| (no tool) | 0 | 2.2k |
| Agent | 2 | 638 |
| SendMessage | 1 | 244 |
| Monitor | 1 | 145 |
| **Total** | 56 | 22.0k |
