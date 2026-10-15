## 1. Dependency

- [x] 1.1 [req: pinned-express] Run `npm install express@^4.22.3 --save` in the
      worktree root so `package.json` gains `"dependencies": {"express": "^4.22.3"}`
      and `package-lock.json` is created. Commit both files. Add no other
      dependency.
- [x] 1.2 [req: npm-start] In `package.json` `scripts`, add
      `"start": "node src/server.js"` beside the existing `"test": "node --test"`.

## 2. Tests first

- [x] 2.1 [req: app-factory, health-endpoint] Create `test/app.test.js` using
      `node:test`, `node:assert/strict`, and global `fetch`. Add: (a) a test that
      calls `createApp({})`, listens on port 0 at `127.0.0.1`, sends
      `GET /health`, and asserts status `200`, a `content-type` starting with
      `application/json; charset=utf-8`, and body deep-equal `{ status: "ok" }`; (b) a test that
      builds two apps with `createApp({})`, listens each on port 0, and asserts
      both answer `GET /health` with `200`. Close every server in an `after` or
      `finally`.
- [x] 2.2 [req: loopback-server] In `test/app.test.js`, add a test that imports
      `startServer` from `../src/server.js`, awaits `startServer({ port: 0 })`,
      asserts `server.address().address === "127.0.0.1"`, fetches
      `GET /health` on `server.address().port` expecting `200`, then closes the
      server. The import itself must not start a server.
- [x] 2.3 [req: app-factory, health-endpoint, loopback-server] Run `npm test` and
      observe the new tests fail because `src/app.js` and `src/server.js` do not
      exist yet.

## 3. Implementation

- [x] 3.1 [req: health-endpoint] Create `src/routes/health.js` whose default
      export is `(store) => Router` (the `store` argument is accepted and
      unused). It creates `express.Router()` and registers
      `GET /health` responding `res.status(200).json({ status: "ok" })`.
- [x] 3.2 [req: app-factory] Create `src/app.js` exporting
      `createApp({ store } = {})`: build `const app = express()`, call
      `app.use(healthRouter(store))` with the default import from
      `./routes/health.js`, and `return app`. Never call `listen`. Mount nothing
      else (no body parser, no static files, no 404 or error handler).
- [x] 3.3 [req: loopback-server] Create `src/server.js` exporting
      `async function startServer({ port = process.env.PORT ?? 4321, store } = {})`
      that calls `createApp({ store })`, listens with
      `app.listen(Number(port), "127.0.0.1")`, resolves to the returned
      `http.Server` once its `listening` event fires, and rejects on its `error`
      event.
- [x] 3.4 [req: npm-start] At the bottom of `src/server.js`, when
      `process.argv[1]` is set and
      `import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href`
      (import `pathToFileURL` from `node:url` and `realpathSync` from
      `node:fs`), await `startServer()` and print
      `banny listening on http://127.0.0.1:${server.address().port}/` with
      `console.log`.

## 4. Docs and verification

- [x] 4.1 [req: npm-start] In `README.md`, add a `## Run the board` section
      before `## Run the tests` with `npm install` and `npm start`, stating the
      server listens on `http://127.0.0.1:4321/` (override with `PORT`) and that
      `GET /health` returns `{"status":"ok"}`.
- [x] 4.2 [req: *] Run `npm test` and confirm every test passes, including
      `test/smoke.test.js`. Then run `npm start`, confirm the stdout line
      `banny listening on http://127.0.0.1:4321/`, confirm
      `curl -s http://127.0.0.1:4321/health` prints `{"status":"ok"}`, and stop
      the server.
