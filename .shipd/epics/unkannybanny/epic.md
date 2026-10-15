# unkannybanny
Status: complete
Theme: banny-board

## Introduction

shipd has never built a whole application from an empty repository through
its own pipeline. Each stage has shipped on this engine's own repository, but
a fresh repo with no capability library, no code, and no conventions is the
test that shows whether epic, grill, autopilot, review gate, and PR room hold
together end to end.

unkannybanny is that test: a banny board, a localhost HTTP service over a
JSON-file store. Items carry a title, a done flag, and tags. The service
exposes them over a small REST API, a static board page, and a CLI, with seed
and export verbs for moving data in and out.

The outcome is nine member changes, each shipped as its own auto-merged pull
request with the semantic-review gate posted and dispositioned, so every PR's
room carries real agent traffic. Success criteria:

- Every member merges through `ci` and `semantic-review` with zero unresolved
  threads, driven by `/s:autopilot unkannybanny`.
- `npm start` serves the board at `http://127.0.0.1:4321/` and `npm test`
  stays green after every merge.
- Each merged PR shows the gate's finding tasks taken by an agent in the room.

### Non-goals

- No authentication, accounts, or multi-user permissions.
- No database other than one JSON file; no migrations, no ORM.
- No TypeScript, bundler, or frontend framework; the board page is one static
  HTML file with inline script.
- No deployment, container, or hosting beyond `localhost`.
- No change to the shipd plugin: a gap found in the pipeline is reported, not
  patched from this epic.

## References

- [unkannybanny end-to-end brief](../../docs/unkannybanny-end-to-end-brief/doc.md) — the request and the decisions taken with the user.

## Decisions

- **Node 22+, ES modules, Express 4 as the one runtime dependency.**
  `package.json` has `"type": "module"`; `express` is pinned with a caret on
  its 4.x line and `package-lock.json` is committed. Tests use `node:test`,
  `node:assert/strict`, and the global `fetch` against an app listening on
  port 0; no `supertest`, no test framework. Rejected: Express 5, whose
  async error semantics differ from the documented 4.x behaviour the members
  rely on.
- **One JSON file is the database.** `src/store.js` owns it: the path comes
  from `BANNY_DATA`, default `data/banny.json`; `data/` is gitignored. The
  store keeps the whole file in memory as a cache and reloads it before every
  read and mutation whenever the file's mtime or size differs from what it
  last loaded, because the CLI writes the same file while the server runs.
  It writes through on every mutation by writing a uniquely named temp file
  beside it and renaming, so a crash never leaves a half-written file; writes
  are serialized through one queue, each awaiting the previous, so an older
  snapshot never lands after a newer one. Ids are `crypto.randomUUID()`. The
  file shape is `{"items": [...]}`; a missing file reads as empty. Rejected:
  SQLite, which is a second database and a native dependency.
- **The item shape is fixed here, not per member.** An item is
  `{id, title, done, tags, createdAt, updatedAt}`: `title` is a trimmed
  string of 1 to 200 characters and required; `done` is a boolean, default
  `false`; `tags` is an array of at most 10 distinct kebab-case strings
  (`[a-z0-9]+(-[a-z0-9]+)*`), default `[]`; timestamps are ISO-8601 strings
  set by the store. `src/items.js` owns validation and is the only place that
  rejects a shape; the API, the CLI, and seed all call it.
- **Errors are JSON, one shape.** Every error response body is
  `{"error": {"code": "<kebab-code>", "message": "<text>"}}`. Validation is
  `400` with code `invalid-item`; an unknown id is `404` with code
  `not-found`; an unknown route is `404` with code `no-route`; anything
  unhandled is `500` with code `internal`. The API speaks JSON only and
  returns `415` with code `unsupported-media-type` for a non-JSON body and
  `400` with code `invalid-json` for a malformed one. items-api owns JSON
  body parsing and both of those responses; the error handler maps a body
  parser's error to `invalid-json`, never to `internal`.
- **The server binds `127.0.0.1` only.** `src/server.js` listens on `PORT`
  (default `4321`) on the loopback address and never on all interfaces.
  `src/app.js` exports `createApp({ store })` and never listens, so tests and
  the server share one app factory.
- **Layout is fixed.** `src/app.js`, `src/server.js`, `src/store.js`,
  `src/items.js`, `src/routes/<area>.js` (one router per area, mounted by
  `createApp`), `src/log.js`, `bin/banny.js`, `public/index.html`, and
  tests under `test/<area>.test.js`. A member adds files only in its own
  area and edits `src/app.js` only to mount its router.
- **Every member ships tests and keeps `npm test` green.** A member adds a
  `test/<area>.test.js` that starts the app on port 0 against a store in a
  temp directory, so tests never touch `data/`. No member edits another
  member's tests except to fix a break it caused. json-store's tests cover
  overlapping mutations and a write made to the file from outside the store;
  items-api's tests cover a malformed body (`400 invalid-json`) and a
  non-JSON body (`415`).
- **The capability library starts empty, so every delta is `ADDED`.** Each
  member creates its own capability named after its area; a later member that
  changes an earlier member's contract writes a `MODIFIED` delta against it.
- **Pull requests mirror shipd.** Each member is one worktree, one branch,
  one squash-merged PR gated by `ci` and `semantic-review` with every review
  thread resolved; the gate posts its findings as room tasks, which is the
  traffic this epic exists to produce. No member bumps a version: this is an
  app, not the plugin.
- **The room wake is a member, not a bootstrap step.** The managed
  `room-wake.yml` and its bundled runtime are installed by the shipd verb,
  committed, and shipped like any other change, so the pipeline is tested on
  an infrastructure change too. The `COPILOT_GITHUB_TOKEN` secret it needs
  is a human step outside the epic; until it exists the wake runs and exits
  without posting, and `shipd room watch` from a session is the live path.

## Design

The board is four layers over one file:

```
  public/index.html ──▶ src/app.js ──▶ src/routes/{health,items,tags,export}.js
                              │                 │
                              │                 ▼
                              │            src/items.js   (validate)  ◀───┐
                              ▼                 │                         │
                          src/log.js            ▼                         │
                                           src/store.js  ◀── bin/banny.js─┘
                                                │
                                                ▼
                                          data/banny.json
```

The store and the app factory are the two roots, and they do not depend on
each other, so they are built first and in parallel. The items API joins
them. Tags and search extend the items router's query surface. The CLI
reuses the store and the validator directly, without the server. Seed and
export sit on the CLI and the API. The board page is the last consumer of
the API. Request logging and the error handler wrap the app and depend only
on the factory. The room wake touches `.github/` alone.

Each `src/routes/<area>.js` exports a function `(store) => Router`, and
`createApp` mounts the request logger first, then its routers in a fixed
order: health, items, tags, export, then the static page, then the
`no-route` handler, then the error handler. The `After` column below orders the members along those
seams.

## Changes

| Change | Description | Code | Integration | Unknowns | Risk | After |
| --- | --- | --- | --- | --- | --- | --- |
| app-scaffold | Express app factory, `GET /health`, `src/server.js` on `127.0.0.1:4321`, `npm start`, the pinned dependency and lockfile | low | low | low | low | |
| json-store | `src/store.js`: load, in-memory cache, atomic write-through, `BANNY_DATA`, ids and timestamps | medium | low | low | low | |
| room-wake-install | Install the shipd room wake managed files under `.github/` so a room task wakes CI | low | medium | medium | medium | |
| items-api | `src/items.js` validation and `src/routes/items.js`: list, create, read, update, delete with the fixed error shape | medium | medium | low | medium | app-scaffold, json-store |
| request-logging | `src/log.js`: one JSON log line per request with `X-Request-Id`, the `no-route` handler, and the `internal` error handler | low | medium | low | low | app-scaffold |
| tags-and-search | `?tag=` and `?q=` filters on `GET /items`, and `GET /tags` with per-tag counts | low | medium | low | low | items-api |
| banny-cli | `bin/banny.js` with `list`, `add`, `done`, `remove` against the store directly, exit codes and JSON output flag | medium | medium | low | medium | items-api |
| seed-and-export | `banny seed` with sample items, `banny export` to stdout, and `GET /export` returning the store as a JSON download | low | medium | low | low | banny-cli |
| board-page | `public/index.html`: list items with tags, add form, done toggle, tag filter, served at `/` | medium | medium | medium | medium | tags-and-search |
