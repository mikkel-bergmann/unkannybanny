# column-stats
Status: verified
Planned-at: fbe17a8fb52ea627d8963c9513fd88fce4ca1a79
Gated-hash: d92b913476b6

## Idea

Report how many cards sit in each column, in board order, plus how many sit in no column, from both `GET /stats` and `banny stats`.

### Motivation

A user running the board cannot see how work is spread across lanes without counting cards by hand, because stats only report totals, done, open, and tags. The columns feature added lanes but left the stats blind to them.

### Details

- `src/routes/stats.js`: `computeStats(items, columns)` adds `columns` (`[{id, name, count}]` in board order) and `unassigned`; the route reads items and columns.
- `bin/banny.js`: `banny stats` passes columns and prints the extra lines.
- `test/stats.test.js`: updated expectations and new cases.

Affected capabilities: `stats` (added; stats behavior had no spec). Impact: no new dependency; existing keys keep their meaning.

### Non-goals

- No change to `total`, `done`, `open`, or `tags`.
- No per-column done or open split, and no column filter on `GET /stats`.
- No board-page change.

## Implementation

- **Array of `{id, name, count}`, not an object keyed by name (Q1).** An array carries board order and survives duplicate column names; `id` lets clients join to `GET /columns`. Rejected: a name-keyed object, which loses order in consumers and collides on equal names.
- **Dangling `columnId` counts as unassigned.** The board page already shows such cards in its `Unassigned` lane, so the counts agree with what the user sees and always sum to `total`.
- **Text format (Q2).** `column <name>: <n>` lines after the existing four, then `unassigned: <n>`. The `column ` prefix keeps lines distinct from the fixed keys when a column is named `total`. Rejected: a table, which the single-line `key: value` style does not use.
- **One shared function.** The route and the CLI both call `computeStats`, so `--json` equals the route body by construction.
- Read both lists with `Promise.all` in the route; a failure in either reaches the existing error handler (500).

Risk: existing consumers that deep-equal the stats object see two new keys; the in-repo tests are updated with the change.

## Questions and answers

### Q1: What JSON shape carries the per-column counts?
- **Question:** Should `GET /stats` carry `columns` as an array of `{id, name, count}` plus `unassigned`, or an object keyed by name? Recommendation: the array.
- **Verdict:** INSUFFICIENT
- **Answered by:** USER
- **Answer:** The array of `{id, name, count}` plus `unassigned`, taking the recommended option because it keeps board order and survives equal names.
- **Queued:** q-stats-column-json

### Q2: What text format does `banny stats` print for columns?
- **Question:** Should the text use `column <name>: <n>` lines then `unassigned: <n>`, or a table? Recommendation: the lines.
- **Verdict:** INSUFFICIENT
- **Answered by:** USER
- **Answer:** The `column <name>: <n>` lines then `unassigned: <n>`, taking the recommended option because it matches the existing `key: value` style.
- **Queued:** q-stats-column-text

## Readiness attestation

### Problem and motivation

Stats ignore columns, so users cannot see lane load.

Evidence:

- `src/routes/stats.js:3-7` computes only total, done, open, and tags.
- `src/store.js` exposes `listColumns`, so the data exists.

### Scope and non-goals

The change touches the stats function, route, CLI verb, and their tests; the board page and other counts stay out.

Evidence:

- In scope: `src/routes/stats.js`, `bin/banny.js:109-120`, `test/stats.test.js`.
- Out of scope: `public/index.html`, `src/store.js`.

### Affected capabilities and files

One new capability, `stats`, because no verified spec covers stats; three files change.

Evidence:

- `grep -ril stats .shipd/verified` finds no match, so the delta is ADDED.
- Runnable premise: `npm test` passes on main before the change (existing `test/stats.test.js` asserts the four-key object).
- Dangling-reference precedent: `verified/board-page` requirement `board-list-filter`.

### No open task-shaping decision

Both shape decisions are settled with the recommended options; none remain.

Evidence:

- Q1 and Q2 above; oracle lookups returned no standing position.
