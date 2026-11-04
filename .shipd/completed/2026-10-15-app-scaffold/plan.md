# app-scaffold
Status: verified
Epic: unkannybanny

## Idea

Add the Express app factory, a `GET /health` route, and a loopback-only
server started by `npm start`, with Express 4 pinned and locked.

### Motivation

Every route-owning member of the unkannybanny epic mounts its router through
`createApp` and tests against it, so none of them can start until the factory,
the server entry point, and the one runtime dependency exist.

### Details

- `package.json`: `express` `^4.22.3` as the only dependency, a committed
  `package-lock.json`, and `"start": "node src/server.js"`.
- `src/app.js`: `createApp({ store } = {})`, which mounts the health router
  and never listens.
- `src/routes/health.js`: `(store) => Router` serving `GET /health`.
- `src/server.js`: `startServer({ port, store } = {})` bound to `127.0.0.1`,
  run when the file is the entry point.
- `test/app.test.js`: factory, health, and loopback-bind tests.
- `README.md`: how to run the board.

Affected capabilities: `app-scaffold` (added). No other member's files change.

### Non-goals

- No store: `src/store.js` belongs to json-store, and server.js passes no
  store yet (Q2).
- No JSON body parser, static page, `no-route` handler, error handler, or
  request logger; items-api, board-page, and request-logging own those.
- No graceful-shutdown signal handling and no host override.

## Implementation

- **Router contract.** Each `src/routes/<area>.js` default-exports
  `(store) => express.Router()`, per the epic's Design. `createApp` calls
  `app.use(healthRouter(store))`; later members add their own `app.use` lines
  in the epic's fixed order (logger first, then health, items, tags, export,
  static, `no-route`, error handler). The health router accepts `store` and
  ignores it.
- **Health body.** `GET /health` answers `200` with `res.json({ status: "ok" })`
  (Q1). Fixed and deterministic, so tests deep-equal it. Rejected: uptime and
  version fields, which make the body non-deterministic for no consumer.
- **Server shape.** `src/server.js` exports
  `startServer({ port = process.env.PORT ?? 4321, store } = {})`, which calls
  `createApp({ store })`, listens with `app.listen(Number(port), "127.0.0.1")`,
  and resolves to the `http.Server` on `listening` (rejects on `error`). The
  entry-point guard
  `import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href`
  (banny-cli's guard; it holds when the path crosses a symlink) calls
  `startServer()` and logs `banny listening on http://127.0.0.1:<port>/`
  (Q3). Tests import `startServer` and assert `address().address` with port 0.
  Rejected: spawning `node src/server.js` and parsing stdout, which is slower
  and flakier; and testing only the factory, which leaves the loopback bind
  unchecked.
- **Store wiring.** server.js passes no store now (Q2). The first member that
  needs a store at runtime, items-api, constructs it in `src/server.js` from
  `BANNY_DATA` and passes it to `createApp`. This is an epic-scope note: the
  epic's layout rule permits edits to `src/app.js` only to mount a router, so
  the edit to `src/server.js` is flagged for `/s:epic unkannybanny amend`.
  Rejected: a dynamic `import("./store.js")` fallback, speculative code that
  hides a missing module; and making app-scaffold wait on json-store, which
  breaks the epic's parallel roots.
- **Dependency pin.** `npm install express@^4.22.3 --save` writes the caret
  range and the lockfile. 4.22.3 is the newest 4.x on the registry. CI's
  `npm install` resolves from the committed lockfile.
- **Tests.** One file, `test/app.test.js` (the app area), using `node:test`,
  `node:assert/strict`, and global `fetch` on port 0, closing every server.
  `test/smoke.test.js` stays untouched.

Risk: a test that leaves a server open keeps `node --test` from exiting;
every test closes its servers in `after` or `finally`.

## Questions and answers

### Q1: What body does GET /health return?
- **Question:** What does `GET /health` return? Options: (1) `200` with
  `{"status":"ok"}`; (2) `200` with `{"ok":true}`; (3) `200` with status,
  uptime, and package version. Recommendation: (1).
- **Verdict:** INSUFFICIENT
- **Answered by:** USER
- **Answer:** Option 1, `200` with `{"status":"ok"}`: fixed, deterministic,
  and testable by deep equality.
- **Queued:** q-unkannybanny-health-response-body

### Q2: How does server.js get a store before json-store exists?
- **Question:** app-scaffold and json-store build in parallel, so server.js
  cannot import `src/store.js`. Options: (1) server.js passes no store now and
  items-api edits server.js to build the store from `BANNY_DATA`; (2)
  server.js dynamically imports `./store.js` when present; (3) app-scaffold
  waits on json-store. Recommendation: (1).
- **Verdict:** INSUFFICIENT
- **Answered by:** USER
- **Answer:** Option 1. server.js calls `createApp({ store })` with whatever
  store `startServer` receives, and passes none from the entry point; items-api
  adds the store construction in `src/server.js`. The epic's layout rule does
  not name that edit, so it is flagged for an epic amendment.
- **Queued:** q-app-scaffold-server-store-wiring
- **Relied on by:** items-api

### Q3: How is server.js shaped so the loopback bind is testable?
- **Question:** Options: (1) export `startServer({ port, store } = {})`
  bound to `127.0.0.1`, run only as the entry point, tested by import on port
  0; (2) listen on import and test by spawning `node src/server.js`; (3) test
  only `createApp`. Recommendation: (1).
- **Verdict:** INSUFFICIENT
- **Answered by:** USER
- **Answer:** Option 1: `startServer` resolves to the `http.Server`, the
  entry-point guard starts it and prints
  `banny listening on http://127.0.0.1:<port>/`, and the test asserts
  `server.address().address === "127.0.0.1"`.
- **Queued:** q-server-loopback-bind-testability
- **Relied on by:** items-api

## Readiness attestation

### Problem and motivation

Every route-owning epic member mounts on `createApp`, so the factory, server,
and Express dependency must exist first.

Evidence:

- Epic `unkannybanny` Decisions: "`src/app.js` exports `createApp({ store })`
  and never listens"; the Changes table puts app-scaffold before items-api and
  request-logging.
- `package.json` has no `dependencies` and no `start` script; no `src/` exists.

### Scope and non-goals

The change adds the factory, the health router, the server, the dependency,
one test file, and a README section; store, body parsing, logging, and error
handling stay with their members.

Evidence:

- Epic Changes table rows for json-store, items-api, request-logging, and
  board-page own the excluded surfaces.
- Epic Decisions: "items-api owns JSON body parsing".

### Affected capabilities and files

One new capability, `app-scaffold`, and seven files: `package.json`,
`package-lock.json`, `src/app.js`, `src/routes/health.js`, `src/server.js`,
`test/app.test.js`, `README.md`.

Evidence:

- Capability `app-scaffold`: requirements `app-factory`, `health-endpoint`,
  `loopback-server`, `npm-start`, `pinned-express` (all ADDED; the library is
  empty).
- Files: `package.json:1-13`, `README.md:1-15`; the rest are new.
- Runnable premise: `npm test` in the worktree → exit 0, `node --test`
  discovered and passed `test/smoke.test.js`, so a new `test/app.test.js` is
  picked up without config.
- Runnable premise: `npm view express@4 version` → newest is `4.22.3`.

### No open task-shaping decision

Every task-shaping decision is settled.

Evidence:

- Health body: planner default, Q1.
- Store wiring in server.js: planner default, Q2.
- Server shape and test approach: planner default, Q3.
- Router contract, mount order, host, port, test tooling: the epic's
  Decisions and Design.
