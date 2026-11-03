# tags-and-search
Status: verified
Epic: unkannybanny

## Idea

Add `?tag=` and `?q=` filters to `GET /items` and a `GET /tags` route that
lists every tag in use with its item count.

### Motivation

The board page's tag filter and anyone with more than a screenful of items
need to narrow the list and see which tags exist, and items-api only returns
every item unfiltered. board-page lists this member under `After` and cannot
build its tag filter until these endpoints exist.

### Details

- `src/routes/tags.js`: default-exports the tags router serving `GET /tags`,
  and named-exports the pure helpers `filterItems(items, query)`,
  `countTags(items)`, and `class InvalidQueryError`.
- `src/routes/items.js`: the `GET /items` handler filters through
  `filterItems`; the router's error middleware maps `InvalidQueryError` to
  `400 invalid-query`.
- `src/app.js`: one line mounting the tags router directly after items.
- `test/tags.test.js`: helper unit tests and HTTP tests on port 0.

Affected capabilities: `tags-and-search` (added). Builds on items-api
(`src/routes/items.js`, `{"items":[...]}`) and json-store (`createStore`,
`list()`); no new dependency.

### Non-goals

- No filters on `GET /tags` and no `done` filter on `GET /items`.
- No pagination, sorting options, fuzzy or word matching, or tag renaming.
- No CLI flags (banny-cli) and no board-page UI.
- No change to `src/items.js` or to item validation.

## Implementation

- **Placement (Q1).** The helpers live in `src/routes/tags.js`, this
  member's own file, and `src/routes/items.js` imports `filterItems` and
  `InvalidQueryError` from `./tags.js`. The edit to items-api's router is the
  minimum the epic Design sanctions ("Tags and search extend the items
  router's query surface"): the `GET /items` handler and one error branch.
  The items router must still answer `GET /items` because it is mounted
  first. Rejected: helpers in `src/items.js` (validation only) and a new
  `src/search.js` (outside the fixed layout).
- **Tag filter (Q2).** `req.query.tag` is a string (`?tag=a`) or an array
  (`?tag=a&tag=b`), as observed on Express 4.22.3. Every named tag must be on
  the item (AND), by exact match.
- **Search (Q3).** `q` is trimmed and lower-cased; an item matches when
  `title.toLowerCase().includes(q)`. An empty or whitespace-only `q` is no
  filter. `tag` and `q` combine with AND. Filtering keeps store order.
- **Malformed filters (Q4).** `filterItems` throws `InvalidQueryError`
  (`code = "invalid-query"`, `status = 400`) when a `tag` value is not a
  string matching `/^[a-z0-9]+(-[a-z0-9]+)*$/` (so `?tag=` and `?tag[x]=y`
  fail) or `q` is present but not a string (`?q=a&q=b`). Other query keys
  are ignored. The items router answers it locally with
  `{"error":{"code":"invalid-query","message":...}}`, so it works whether or
  not request-logging has merged; its `status`/`code` also fit
  request-logging's 4xx pass-through.
- **Tag counts (Q5).** `GET /tags` answers `200 {"tags":[{"tag","count"}]}`,
  one entry per tag on at least one item, counted over all items, sorted by
  tag name with plain string comparison (`a < b`); no items gives
  `{"tags":[]}`. The router wraps its handler so a store rejection goes to
  `next(err)`.
- **Mount.** `src/app.js` gains `app.use(tagsRouter(store))` directly after
  the items line, per the epic's fixed order.
- **Tests.** `test/tags.test.js` builds `createApp({ store: createStore({
  path }) })` on a `mkdtemp` file per test, listens on port 0, uses global
  `fetch`, and closes every server.

Risk: items-api's router changes shape before merge; the edit is limited to
the list handler and one error branch, both named in items-api's plan.

## Questions and answers

### Q1: Where do the filter and count helpers live?
- **Question:** Options: (1) named exports `filterItems`, `countTags`, and
  `InvalidQueryError` from `src/routes/tags.js`, called from the
  `GET /items` handler in `src/routes/items.js`; (2) helpers in
  `src/items.js`; (3) a new `src/search.js`. Recommendation: (1).
- **Verdict:** INSUFFICIENT
- **Answered by:** USER
- **Answer:** Option 1: the logic stays in this member's own file, and the
  items router gains only the call the epic Design sanctions.
- **Queued:** q-tags-search-filter-placement

### Q2: How does `?tag=` match?
- **Question:** Options: (1) exact match, repeated `tag` params combine with
  AND; (2) repeated params combine with OR; (3) one param, comma-separated
  values with AND. Recommendation: (1).
- **Verdict:** INSUFFICIENT
- **Answered by:** USER
- **Answer:** Option 1: each added tag narrows the list, and Express already
  parses repeated params into an array.
- **Queued:** q-items-tag-filter-matching
- **Relied on by:** board-page

### Q3: What does `?q=` match?
- **Question:** Options: (1) case-insensitive substring of the title, `q`
  trimmed, empty means no filter, AND with `tag`; (2) the same, also
  matching tag names; (3) whole-word or word-prefix matching.
  Recommendation: (1).
- **Verdict:** INSUFFICIENT
- **Answered by:** USER
- **Answer:** Option 1: the simplest predictable search; tags already have
  their own filter.
- **Queued:** q-items-search-q-matching

### Q4: What answers a malformed filter?
- **Question:** Options: (1) `400` with new code `invalid-query` when a
  `tag` is not a kebab-case string or `q` is not a single string; (2)
  ignore malformed values; (3) `400` reusing `invalid-item`.
  Recommendation: (1).
- **Verdict:** INSUFFICIENT
- **Answered by:** USER
- **Answer:** Option 1: a client error is reported in the epic's error
  shape rather than silently widening the result.
- **Queued:** q-items-list-malformed-filter-response

### Q5: What does `GET /tags` answer?
- **Question:** Options: (1) `200 {"tags":[{"tag":"shop","count":2}]}`,
  counted over all items, no filters, sorted by tag name; (2) an object map
  `{"tags":{"shop":2}}`; (3) the array sorted by count descending.
  Recommendation: (1).
- **Verdict:** INSUFFICIENT
- **Answered by:** USER
- **Answer:** Option 1: an enveloped, ordered list matches `GET /items` and
  renders as a stable filter row on the board.
- **Queued:** q-tags-endpoint-response-shape
- **Relied on by:** board-page

## Readiness attestation

### Problem and motivation

Clients cannot narrow the item list or see the tags in use, and board-page
waits on both.

Evidence:

- Epic `unkannybanny` Changes table: the tags-and-search row, and board-page
  lists tags-and-search under `After` with a "tag filter".
- items-api requirement `items-routes`: `GET /items` returns every item.

### Scope and non-goals

Two filters on the list route and one counts route; no UI, CLI, or
validation change.

Evidence:

- Epic Design: "Tags and search extend the items router's query surface";
  router mount order health, items, tags, export.
- banny-cli and board-page own the CLI and the page (epic Changes table).

### Affected capabilities and files

One new capability; two new files and two edited files.

Evidence:

- Capability `tags-and-search` (added); the library is empty.
- New: `src/routes/tags.js`, `test/tags.test.js`.
- Edited: `src/routes/items.js` (list handler, error middleware) per
  items-api's plan tasks 3.2 and 3.3; `src/app.js` (mount) per
  app-scaffold's router contract.
- Store: `createStore({ path })` and `list()` per json-store Q1.
- Runnable premise: an Express 4.22.3 probe echoing `req.query` showed
  `?tag=a` → `"a"`, `?tag=a&tag=b` → `["a","b"]`, `?tag[x]=y` →
  `{"x":"y"}`, `?tag=` → `""`, `?q=a&q=b` → `["a","b"]`.

### No open task-shaping decision

Every decision is settled by planner defaults after the oracle queued them.

Evidence:

- Q1 placement, Q2 tag matching, Q3 search matching, Q4 malformed filters,
  Q5 tags shape.
- Inherited: list envelope (items-api Q2), router-local error middleware
  (items-api Q5), store interface (json-store Q1).
