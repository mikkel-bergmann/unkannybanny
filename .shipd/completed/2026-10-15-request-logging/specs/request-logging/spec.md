## ADDED Requirements

### Requirement: One JSON log line per request
id: request-log-line

The system SHALL export from `src/log.js` a function
`requestLogger({ write } = {})` returning Express middleware. When a response
finishes or its connection closes, the middleware SHALL call `write` exactly
once with one `JSON.stringify`'d object holding, in this key order, `time`
(ISO-8601 time the request arrived), `id` (the request id), `method`, `path`
(`req.originalUrl`), `status` (the response status code), and `ms` (whole
milliseconds elapsed), plus `error` (the error's message) when the error
handler answered `500 internal`. Where no `write` is given, the line SHALL be
written to `process.stdout` followed by a newline.

#### Scenario: A request produces exactly one line
- **WHEN** a test mounts `requestLogger({ write })` with a capturing `write`
  on an app and sends `GET /health?x=1`
- **THEN** `write` is called once, and its argument parses as JSON with
  `method` `GET`, `path` `/health?x=1`, `status` `200`, a string `time`, a
  string `id` equal to the response's `X-Request-Id`, and an integer `ms`
  of at least `0`, and no `error` key

#### Scenario: A failed request logs the error message
- **WHEN** a route throws `new Error("boom")` behind the request logger and
  the error handler
- **THEN** the one logged line has `status` `500` and `error` `boom`

### Requirement: Request id on every response
id: request-id

The request logger SHALL set an `X-Request-Id` response header on every
response before any later handler runs, and SHALL expose the same value as
`req.id`. When the request carries an `X-Request-Id` header matching
`^[A-Za-z0-9._-]{1,128}$`, the system SHALL reuse it; otherwise it SHALL use
`crypto.randomUUID()`.

#### Scenario: A generated id is a UUID
- **WHEN** a client sends `GET /health` with no `X-Request-Id`
- **THEN** the response carries an `X-Request-Id` that is a version 4 UUID,
  and two such requests receive different ids

#### Scenario: A valid client id is echoed
- **WHEN** a client sends `GET /health` with `X-Request-Id: abc-123`
- **THEN** the response's `X-Request-Id` is `abc-123`

#### Scenario: An invalid client id is replaced
- **WHEN** a client sends `GET /health` with an `X-Request-Id` of 129 `a`
  characters, or one containing a space
- **THEN** the response's `X-Request-Id` is a freshly generated UUID

### Requirement: Unknown routes answer no-route
id: no-route

The system SHALL export from `src/log.js` a handler `noRoute(req, res)` that
answers `404` with the JSON body
`{"error":{"code":"no-route","message":"No route for <METHOD> <path>"}}`,
where `<path>` is `req.path`.

#### Scenario: Unknown path is a JSON 404
- **WHEN** a client sends `GET /nope?x=1` to an app built by `createApp({})`
- **THEN** the status is `404`, the `Content-Type` starts with
  `application/json`, the body deep-equals
  `{"error":{"code":"no-route","message":"No route for GET /nope"}}`, and the
  response carries an `X-Request-Id`

### Requirement: Final error handler
id: error-handler

The system SHALL export from `src/log.js` a four-argument Express error
handler `errorHandler(err, req, res, next)`. If `err.status` (or
`err.statusCode`) is an integer from 400 to 499 and `err.code` is a
kebab-case string (`^[a-z0-9]+(-[a-z0-9]+)*$`), the handler SHALL answer that
status with `{"error":{"code": err.code, "message": err.message}}`. For every
other error the handler SHALL answer `500` with
`{"error":{"code":"internal","message":"Internal server error"}}`, never
revealing the error's own message or stack, and SHALL record the error's
message for the request log line. If the response headers were already sent,
the handler SHALL call `next(err)` and write nothing.

#### Scenario: A thrown error is a 500 internal
- **WHEN** a route throws `new Error("secret detail")` on an app with the
  request logger, the route, `noRoute`, and `errorHandler` mounted
- **THEN** the status is `500`, the body deep-equals
  `{"error":{"code":"internal","message":"Internal server error"}}`, and the
  body does not contain `secret detail`

#### Scenario: A coded client error passes through
- **WHEN** a route calls `next(err)` where `err` is an `Error("bad body")`
  with `status` `400` and `code` `invalid-json`
- **THEN** the status is `400` and the body deep-equals
  `{"error":{"code":"invalid-json","message":"bad body"}}`

#### Scenario: A coded error without a client status stays internal
- **WHEN** a route calls `next(err)` where `err` has `code` `store-corrupt`
  and no `status`
- **THEN** the status is `500` with code `internal`

### Requirement: createApp mounts logging and handlers in order
id: app-mount-order

`createApp({ store } = {})` in `src/app.js` SHALL mount `requestLogger()`
before every router, then its routers in the epic's fixed order, then
`noRoute`, then `errorHandler` as the last middleware.

#### Scenario: Factory wiring
- **WHEN** a test builds `createApp({})` and reads `app._router.stack`
- **THEN** the last layer's `handle` is `errorHandler`, the layer before it is
  `noRoute`, and a `GET /health` response carries an `X-Request-Id`
