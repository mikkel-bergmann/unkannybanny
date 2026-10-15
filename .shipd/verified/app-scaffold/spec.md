# app-scaffold

### Requirement: App factory never listens
id: app-factory

The system SHALL export from `src/app.js` a function `createApp({ store } = {})`
that returns an Express 4 application without calling `listen`, and SHALL mount
each area router built by calling the router module's default export with
`store`.

#### Scenario: Factory returns an app that does not listen
- **WHEN** a test imports `createApp` from `src/app.js` and calls `createApp({})`
- **THEN** it receives an Express application and no port is bound until the
  test calls `listen` on it

#### Scenario: Two apps are independent
- **WHEN** a test calls `createApp({})` twice and listens on port 0 with each
- **THEN** both answer `GET /health` on their own ports

### Requirement: Health endpoint
id: health-endpoint

When a client sends `GET /health`, the system SHALL respond `200` with a JSON
body exactly `{"status":"ok"}` and a `Content-Type` of `application/json`.

#### Scenario: Health answers ok
- **WHEN** a client sends `GET /health` to an app built by `createApp({})`
- **THEN** the response status is `200`, the `Content-Type` header starts with
  `application/json`, and the parsed body deep-equals `{"status":"ok"}`

### Requirement: Server binds loopback only
id: loopback-server

The system SHALL export from `src/server.js` an async function
`startServer({ port, store } = {})` that listens on host `127.0.0.1` at `port`,
defaulting to `process.env.PORT` and then to `4321`, and resolves to the
listening `http.Server`. The system SHALL never listen on all interfaces.

#### Scenario: Server listens on the loopback address
- **WHEN** a test calls `startServer({ port: 0 })`
- **THEN** the returned server's `address().address` is `127.0.0.1` and
  `GET /health` on that port answers `200`

#### Scenario: Importing the module does not listen
- **WHEN** a test imports `src/server.js` without calling `startServer`
- **THEN** no server is started and the test process exits normally

### Requirement: npm start serves the app
id: npm-start

When a user runs `npm start`, the system SHALL run `node src/server.js`, which
SHALL call `startServer()` and print one line
`banny listening on http://127.0.0.1:<port>/` to stdout once listening.

#### Scenario: Entry point starts the server
- **WHEN** a user runs `npm start` with no `PORT` set
- **THEN** stdout shows `banny listening on http://127.0.0.1:4321/` and
  `GET http://127.0.0.1:4321/health` answers `200` with `{"status":"ok"}`

### Requirement: Express is the one pinned dependency
id: pinned-express

The system SHALL declare `express` as its only runtime dependency in
`package.json` with a caret range on the 4.x line, and SHALL commit a
`package-lock.json` that resolves it.

#### Scenario: Dependency and lockfile are present
- **WHEN** a reviewer reads `package.json` and `package-lock.json`
- **THEN** `dependencies` holds exactly `express` at `^4.22.3`, there is no
  other runtime dependency, and the lockfile records an `express` 4.x version
