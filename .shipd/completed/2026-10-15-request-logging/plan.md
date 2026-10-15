# request-logging
Status: verified
Epic: unkannybanny

## Idea

Add `src/log.js` with a request logger that writes one JSON line per request
and sets `X-Request-Id`, the `no-route` 404 handler, and the final error
handler, and mount them in `createApp`.

### Motivation

Every route member of the unkannybanny epic relies on the epic's single JSON
error shape for unknown routes and unhandled errors, and nobody running the
board can trace a request. Without this member an unknown path gets Express's
HTML 404 page and a thrown error gets an HTML stack trace.

### Details

- `src/log.js`: exports `requestLogger`, `noRoute`, and `errorHandler`.
- `src/app.js`: mounts the logger first and the two handlers last.
- `test/log.test.js`: logger, request id, handler, and wiring tests.

Affected capabilities: `request-logging` (added). Impact: `src/log.js` and
`test/log.test.js` are new; `src/app.js` gains three `app.use` lines.

### Non-goals

- No JSON body parsing and no `invalid-json` or `unsupported-media-type`
  responses; items-api owns them.
- No log levels, log files, rotation, or logging library.
- No wrapper for async route handlers; each router catches its own rejected
  promises and passes them to `next`.
- No change to `src/server.js` or the `startServer` signature.

## Implementation

- **One module (Q1).** `src/log.js` holds all three exports. The epic's fixed
  layout lists `src/log.js` and no errors module. Rejected: `src/errors.js`.
- **`createApp` signature unchanged.** It stays `createApp({ store } = {})`
  from app-scaffold and calls `requestLogger()` with the default sink, so no
  MODIFIED delta is written against the unmerged app-scaffold contract. Tests
  inject `write` into `requestLogger` on a small Express app built in the
  test, and test the factory's wiring by behaviour and by
  `app._router.stack`.
- **Mount order.** In `createApp`: `requestLogger()`, the routers (health
  now; items, tags, export, and static are added between by later members),
  then `noRoute`, then `errorHandler`. Later members insert their
  `app.use` line above `noRoute`.
- **Request id (Q2).** Reuse a client `X-Request-Id` matching
  `^[A-Za-z0-9._-]{1,128}$`, else `crypto.randomUUID()`. The pattern keeps
  header and log injection out. Set on the response before `next()`, so
  404 and 500 responses carry it too. Exposed as `req.id`.
- **Log line (Q3).** One `JSON.stringify` line to stdout with keys `time`,
  `id`, `method`, `path` (`req.originalUrl`), `status`, `ms`, and `error`
  only on a `500 internal`. Written on `finish` or `close`, once, so an
  aborted request still logs. `requestLogger({ write })` takes a sink for
  tests. The 500 error's message rides on `res.locals.error` into the same
  line, so there is still one line per request. Rejected: stderr, and
  silencing under the test runner; stray stdout lines in `node --test` are
  shown and do not fail the run.
- **Error handler (Q4).** An error with an integer `status` or `statusCode`
  from 400 to 499 and a kebab-case `code` is answered with that status, code,
  and message. Everything else is `500` with code `internal` and the fixed
  message `Internal server error`, so internals never leak. json-store's
  `store-corrupt` error has a code but no status, so it is `500 internal`.
  With headers already sent the handler calls `next(err)`, Express's default.
  Rejected: answering every error `500`, which would turn a forwarded
  body-parser error into `internal`, against the epic's Decision.
- **Tests.** `test/log.test.js` uses `node:test`, `node:assert/strict`,
  `express`, and global `fetch` on port 0, and closes every server.

Risk: items-api must send a parser error to `next` as an error with `status`
400 and `code` `invalid-json`, or answer it in its router; a raw body-parser
error has no `code` and would be `500 internal`. This contract is stated in
the `error-handler` requirement for items-api to meet.

Risk: the log line is written on `finish`, after the client may have read the
response; tests wait until the captured line arrives before asserting.

## Questions and answers

### Q1: Where do the no-route and error handlers live?
- **Question:** Options: (1) `src/log.js` exports `requestLogger`, `noRoute`,
  and `errorHandler`; (2) a new `src/errors.js` holds the two handlers.
  Recommendation: (1).
- **Verdict:** ANSWER
- **Answered by:** ORACLE
- **Answer:** Option 1. The epic gives this member one file, `src/log.js`,
  and its fixed layout has no errors module, so a new file would break the
  layout rule.
- **Cited:** epic/unkannybanny

### Q2: Where does the X-Request-Id come from?
- **Question:** Options: (1) reuse a client `X-Request-Id` matching
  `^[A-Za-z0-9._-]{1,128}$`, else `crypto.randomUUID()`; (2) always generate
  `crypto.randomUUID()`. Recommendation: (1).
- **Verdict:** INSUFFICIENT
- **Answered by:** USER
- **Answer:** Option 1: a caller can correlate its own id, and the pattern
  keeps unsafe values out of headers and logs.
- **Queued:** q-request-logging-request-id-source

### Q3: What is the log line's shape and where is it written?
- **Question:** Options: (1) one JSON line to stdout on finish or close, keys
  `time`, `id`, `method`, `path`, `status`, `ms`, plus `error` on a 500, with
  an injectable `write`; (2) the same line to stderr; (3) the same line,
  silenced under the test runner. Recommendation: (1).
- **Verdict:** INSUFFICIENT
- **Answered by:** USER
- **Answer:** Option 1: stdout is the conventional stream for request logs,
  and the injectable sink keeps tests deterministic without global mocks.
- **Queued:** q-request-log-line-shape-and-sink

### Q4: What does the error handler do with a client-status error?
- **Question:** Options: (1) an error with a 400-499 `status` and a
  kebab-case `code` passes through with that status, code, and message;
  everything else is `500 internal` with a fixed message; (2) every error is
  `500 internal`. Recommendation: (1).
- **Verdict:** INSUFFICIENT
- **Answered by:** USER
- **Answer:** Option 1: it lets items-api forward an `invalid-json` error
  without this member owning that response, and it never leaks a 500's
  message.
- **Queued:** q-error-handler-client-status-passthrough
- **Relied on by:** seed-and-export

## Readiness attestation

### Problem and motivation

Route members need the epic's JSON 404 and 500 shape, and operators need a
per-request trace.

Evidence:

- Epic `unkannybanny` Decisions, "Errors are JSON, one shape": unknown route
  is `404 no-route`, anything unhandled is `500 internal`.
- Epic Changes row `request-logging`: "one JSON log line per request with
  `X-Request-Id`, the `no-route` handler, and the `internal` error handler".

### Scope and non-goals

The change adds `src/log.js` and its test and edits `src/app.js`'s mount
lines; body parsing and its errors stay with items-api.

Evidence:

- Epic Decisions: "items-api owns JSON body parsing and both of those
  responses".
- app-scaffold plan Non-goals leave the logger and handlers to this member.

### Affected capabilities and files

One new capability, `request-logging`, and three files: `src/log.js`,
`src/app.js`, `test/log.test.js`.

Evidence:

- Capability `request-logging`: requirements `request-log-line`,
  `request-id`, `no-route`, `error-handler`, `app-mount-order` (all ADDED).
- `src/app.js` comes from app-scaffold's `app-factory` requirement:
  `createApp({ store } = {})` mounting `healthRouter(store)`.
- Runnable premise: an Express 4.22.3 script mounting a middleware, a
  throwing route, `noRoute`, and `errorHandler` printed
  `app._router.stack` names ending `noRoute,errorHandler`, and the throwing
  route and an unknown path answered `500` and `404`.
- Runnable premise: a `node --test` file writing a JSON line to stdout
  printed it and exited 0.

### No open task-shaping decision

Every task-shaping decision is settled.

Evidence:

- Handler module: oracle, Q1.
- Request id source: planner default, Q2.
- Log line shape and sink: planner default, Q3.
- Client-status pass-through: planner default, Q4.
- Mount order, error body shape, test tooling: the epic's Decisions and
  Design.
