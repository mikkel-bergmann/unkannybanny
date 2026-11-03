# items-api
Status: verified
Epic: unkannybanny

## Idea

Add `src/items.js` validation and the `src/routes/items.js` CRUD router over
the JSON store, with JSON-only bodies and the epic's error shape.

### Motivation

The board page, the CLI, tags-and-search, and seed-and-export all create,
read, update, or delete items, and none of them can start until one validator
and one HTTP surface over the store exist.

### Details

- `src/items.js`: `validateNewItem`, `validateItemPatch`, `ItemValidationError`.
- `src/routes/items.js`: `GET /items`, `POST /items`, `GET|PATCH|DELETE /items/:id`.
- `src/app.js`: one line mounting the items router after health.
- `src/server.js`: the entry point builds `createStore()` and passes it on.
- `test/items.test.js`: validator unit tests and HTTP tests on port 0.

Affected capabilities: `items-api` (added). Depends on app-scaffold
(`createApp`, `startServer`) and json-store (`createStore`); no new dependency.

### Non-goals

- No `?tag=`/`?q=` filters or `GET /tags` (tags-and-search).
- No `no-route` handler, `internal` error handler, or request logger
  (request-logging); errors other than the three below go to `next(err)`.
- No `PUT`, bulk, or import routes; no README change.

## Implementation

- **Validator (Q3, Q4).** `src/items.js` exports `class ItemValidationError
  extends Error` with `code = "invalid-item"`, and two pure functions that
  throw it with a message naming the field. `validateNewItem(input)` returns
  `{ title, done, tags }` (title trimmed, `done` default `false`, `tags`
  default `[]`); `validateItemPatch(input)` returns only the present keys,
  and refuses an empty patch. Both are strict: the input must be a plain
  object (not an array or `null`), keys other than `title`/`done`/`tags` are
  refused (so `id` and timestamps cannot be written), duplicate tags are
  refused, never de-duplicated. Tag pattern
  `/^[a-z0-9]+(-[a-z0-9]+)*$/`, at most 10 tags, title 1 to 200 characters
  after trim. The CLI and seed import the same functions. Rejected: result
  objects and silent de-duplication.
- **Routes (Q1, Q2).** `src/routes/items.js` default-exports
  `(store) => express.Router()`. Responses: list `200 {"items": [...]}`,
  create `201` + `Location: /items/<id>` + item, read and patch `200` + item,
  delete `204` empty. Update is `PATCH` only, matching json-store's
  `update(id, patch)`. A store `null`/`false` result becomes `404 not-found`.
  A local `wrap(fn)` forwards rejections to `next` (Express 4 does not). Rejected: a bare array
  list (tags-and-search cannot extend it) and `PUT`.
- **Body parsing (Q5).** `POST` and `PATCH` run `requireJson` (if
  `!req.is("application/json")`, answer `415 unsupported-media-type`), then
  `express.json()`. The router ends with an error middleware: `err.type ===
  "entity.parse.failed"` → `400 invalid-json`; `ItemValidationError` →
  `400 invalid-item`; anything else → `next(err)`. It works whichever of
  items-api and request-logging merges first.
- **Mount.** `src/app.js` only gains `app.use(itemsRouter(store))` after
  health (epic layout rule).
- **Server store.** Per app-scaffold's Q2, the entry-point guard in
  `src/server.js` calls `startServer({ store: createStore() })`;
  `startServer`'s signature is unchanged. `createStore()` reads
  `BANNY_DATA`, default `data/banny.json`. app-scaffold flagged this edit for
  an epic amendment.
- **Tests.** `test/items.test.js` uses a store on a `mkdtemp` file per test,
  port 0, and global `fetch`.

Risk: a parse error reaching an app-level handler would become `500
internal`; the router-local handler catches it first, and the tests pin it.

## Questions and answers

### Q1: Which HTTP method updates an item?
- **Question:** Options: (1) `PATCH /items/:id` with a partial body of
  `title`/`done`/`tags`, at least one; (2) `PUT /items/:id` with a full body;
  (3) both. Recommendation: (1).
- **Verdict:** INSUFFICIENT
- **Answered by:** USER
- **Answer:** Option 1, `PATCH` only: it matches the store's
  `update(id, patch)` and the board's done toggle sends one field.
- **Queued:** q-items-api-update-http-method
- **Relied on by:** board-page

### Q2: What success response shapes does the API use?
- **Question:** Options: (1) list `200 {"items": [...]}`, create `201` with
  the item and `Location`, read and patch `200` with the bare item, delete
  `204`; (2) the same with a bare array list; (3) every body wrapped and
  delete `200` with the removed item. Recommendation: (1).
- **Verdict:** INSUFFICIENT
- **Answered by:** USER
- **Answer:** Option 1: conventional REST codes, and an envelope
  tags-and-search can extend without breaking clients.
- **Queued:** q-items-api-success-response-shapes
- **Relied on by:** tags-and-search, board-page

### Q3: What interface does `src/items.js` export?
- **Question:** Options: (1) `validateNewItem` and `validateItemPatch` that
  return normalized values and throw `ItemValidationError` (`code
  invalid-item`); (2) the same returning `{ ok, value, error }`; (3) one
  `validateItem(input, { partial })`. Recommendation: (1).
- **Verdict:** INSUFFICIENT
- **Answered by:** USER
- **Answer:** Option 1: callers get clean values and the router maps one
  error class to `400 invalid-item`.
- **Queued:** q-items-validator-public-interface
- **Relied on by:** banny-cli, seed-and-export

### Q4: How strict is validation beyond the epic's item shape?
- **Question:** Options: (1) strict: refuse non-object bodies, keys other
  than `title`/`done`/`tags`, duplicate tags, and an empty patch; (2) ignore
  unknown keys and de-duplicate tags; (3) strict types, ignore unknown keys.
  Recommendation: (1).
- **Verdict:** INSUFFICIENT
- **Answered by:** USER
- **Answer:** Option 1: the validator reports every shape fault rather than
  repairing it, so a client never believes it set `id` or a timestamp.
- **Queued:** q-items-validation-strictness

### Q5: Where do body parsing and its 415 and invalid-json responses live?
- **Question:** Options: (1) inside `src/routes/items.js` with a router-local
  error middleware; (2) a global parser and error handler in `createApp`;
  (3) a global parser, mapping left to request-logging. Recommendation: (1).
- **Verdict:** ANSWER
- **Answered by:** ORACLE
- **Answer:** Option 1. The epic gives items-api both responses and limits
  `src/app.js` edits to mounting a router, and option 1 works whichever of
  items-api and request-logging merges first.
- **Cited:** epic/unkannybanny

## Readiness attestation

### Problem and motivation

Four later members need one validator and one HTTP item surface before they
can start.

Evidence:

- Epic `unkannybanny` Changes table: tags-and-search and banny-cli list
  items-api under `After`; the item-shape Decision names `src/items.js` as
  the one validator for the API, the CLI, and seed.

### Scope and non-goals

Validation, five routes, body parsing, the mount, and the server's store; no
filters, logging, or fallback handlers.

Evidence:

- Epic Decision "Errors are JSON, one shape" and the Changes table rows for
  tags-and-search and request-logging.

### Affected capabilities and files

One new capability and five files, built on two unmerged members' interfaces.

Evidence:

- Capability `items-api` (added); the library is empty.
- New: `src/items.js`, `src/routes/items.js`, `test/items.test.js`.
- Edited: `src/app.js` (mount), `src/server.js` (entry point), both per
  app-scaffold's plan (`createApp({ store } = {})`, `startServer({ port,
  store } = {})`); `createStore({ path })` per json-store's plan.
- Runnable premise: an Express 4.22.3 probe showed `express.json()` on
  `{bad` and `"x"` raises `entity.parse.failed` (400), `[1]` parses, and
  `text/plain` or no content type fails `req.is("application/json")`.

### No open task-shaping decision

Every decision is settled: Q5 by the oracle, Q1 to Q4 by planner defaults.

Evidence:

- Q1 verb, Q2 shapes, Q3 interface, Q4 strictness, Q5 parsing placement.
- Store wiring in `src/server.js`: app-scaffold Q2; server shape:
  app-scaffold Q3; store interface: json-store Q1.
