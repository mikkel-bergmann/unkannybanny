## 1. Tests first

- [x] 1.1 [req: request-log-line, request-id] Create `test/log.test.js` using
      `node:test`, `node:assert/strict`, `express`, and global `fetch`. Add a
      helper that builds `express()`, mounts `requestLogger({ write })` with a
      `write` that pushes each line into an array, mounts a
      `GET /health` route answering `res.json({ status: "ok" })` and a
      `GET /boom` route that throws `new Error("boom")`, then `noRoute` and
      `errorHandler`, and listens on port 0 at `127.0.0.1`. Tests: (a) the
      first scenario of `request-log-line` for `GET /health?x=1`, waiting
      until the array holds one line before asserting; (b) `GET /boom` logs
      one line with `status` `500` and `error` `boom`; (c) the three
      `request-id` scenarios (UUID check with
      `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/`).
      Close every server in `after` or `finally`.
- [x] 1.2 [req: error-handler] In `test/log.test.js`, on the same helper app
      with two more routes, add the three `error-handler` scenarios: a route
      throwing `new Error("secret detail")`; a route calling `next(err)` with
      `Object.assign(new Error("bad body"), { status: 400, code: "invalid-json" })`;
      a route calling `next(Object.assign(new Error("x"), { code: "store-corrupt" }))`.
- [x] 1.3 [req: no-route, app-mount-order] In `test/log.test.js`, add tests
      on `createApp({})` from `../src/app.js` listening on port 0: the
      `no-route` scenario for `GET /nope?x=1`, and the `app-mount-order`
      scenario reading `app._router.stack` (`at(-1).handle === errorHandler`,
      `at(-2).handle === noRoute`) plus an `X-Request-Id` on `GET /health`.
- [x] 1.4 [req: *] Run `npm test` and observe the new tests fail because
      `src/log.js` does not exist yet.

## 2. Implementation

- [x] 2.1 [req: request-id, request-log-line] Create `src/log.js` exporting
      `requestLogger({ write = (line) => process.stdout.write(line + "\n") } = {})`.
      The returned middleware: records `new Date()` and
      `process.hrtime.bigint()`; reads `req.get("X-Request-Id")` and keeps it
      if it matches `/^[A-Za-z0-9._-]{1,128}$/`, else uses
      `crypto.randomUUID()` from `node:crypto`; sets `req.id` and
      `res.set("X-Request-Id", id)`; registers one `done` function on both
      `res` `finish` and `close` that runs once (a boolean guard) and calls
      `write(JSON.stringify({ time, id, method: req.method, path: req.originalUrl, status: res.statusCode, ms }))`
      with `ms` the elapsed whole milliseconds, adding `error` when
      `res.locals.error` is set; then calls `next()`.
- [x] 2.2 [req: no-route] In `src/log.js`, export
      `function noRoute(req, res)` answering
      `res.status(404).json({ error: { code: "no-route", message: \`No route for ${req.method} ${req.path}\` } })`.
- [x] 2.3 [req: error-handler] In `src/log.js`, export
      `function errorHandler(err, req, res, next)` (four parameters). If
      `res.headersSent`, return `next(err)`. Let
      `status = err?.status ?? err?.statusCode`; if `Number.isInteger(status)`,
      `status >= 400 && status <= 499`, and `err.code` is a string matching
      `/^[a-z0-9]+(-[a-z0-9]+)*$/`, answer
      `res.status(status).json({ error: { code: err.code, message: err.message } })`.
      Otherwise set `res.locals.error = err?.message ?? String(err)` and answer
      `res.status(500).json({ error: { code: "internal", message: "Internal server error" } })`.
- [x] 2.4 [req: app-mount-order] In `src/app.js`, import `requestLogger`,
      `noRoute`, and `errorHandler` from `./log.js`. In `createApp`, call
      `app.use(requestLogger())` before the existing router `app.use` lines,
      and `app.use(noRoute)` then `app.use(errorHandler)` after them, as the
      last two lines before `return app`. Change nothing else in the file.

## 3. Verification

- [x] 3.1 [req: *] Run `npm test` and confirm every test passes, including
      `test/app.test.js` and `test/smoke.test.js`. Run `npm start`, then
      `curl -si http://127.0.0.1:4321/nope`; confirm a `404` with an
      `X-Request-Id` header and the `no-route` body, and one JSON log line on
      the server's stdout. Stop the server.
