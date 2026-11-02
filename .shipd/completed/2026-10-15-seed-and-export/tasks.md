## 1. Tests first

- [x] 1.1 [req: seed-export-commands] Create `test/seed.test.js` with
      `node:test` and `node:assert/strict`, using the same `BIN` and
      `banny(dataFile, ...args)` `spawnSync` helper as `test/cli.test.js` and a
      fresh `fs.mkdtemp(path.join(os.tmpdir(), "banny-seed-"))` per test.
      Tests: `await import("../bin/banny.js")` exposes `commands` whose
      `Object.keys` deep-equal
      `["list", "add", "done", "remove", "seed", "export"]` and runs no verb;
      `--help` exits `0` and stdout contains all six verbs. Leave
      `test/cli.test.js` unchanged: its verb-table test checks only the first
      four keys.
- [x] 1.2 [req: seed-verb, seed-export-commands] In `test/seed.test.js`, add
      tests: `seed` on a missing file exits `0` and stdout has five lines
      ending in `] Peel the bananas  #kitchen`,
      `] Buy more bananas  #shop #kitchen`, `] Water the banana plant  #garden`,
      `] Write the board README  #docs` (with `[x]`), and
      `] Plan the banana bread bake-off`, the other four with `[ ]`; the
      parsed file holds five items with those titles in order; a second
      `seed` exits `0` with stdout `store is not empty; nothing seeded\n` and
      the file still holds five items; `seed --json` on an empty store parses
      to `{ items }` with five titles in order, and a second `seed --json`
      parses to `{ items: [] }`; `seed extra` exits `2` with empty stdout and
      no file created; a file holding `not json` makes `seed --json` exit `1`
      with `error.code === "store-corrupt"` and the file still `not json`.
- [x] 1.3 [req: export-verb, export-document, export-route, seed-export-commands]
      Create `test/export.test.js` with the same `spawnSync` helper, plus a
      server helper that builds
      `createApp({ store: createStore({ path }) })`, listens on port 0 at
      `127.0.0.1`, and closes in `finally`. Import `serializeExport` from
      `src/routes/export.js` (imported with a relative path from the test file). Seed each test's file with `createStore`:
      open `milk` tagged `["shop"]` and done `bread`. Tests: `export` exits
      `0` and stdout equals `serializeExport(await store.list())` and equals
      the file's bytes; `export` on a missing file prints
      `{\n  "items": []\n}\n`, exits `0`, and the file is still missing;
      `export --json` stdout parses to `{ items }` and is a single line;
      writing `export` stdout to `<dir>/copy.json` and calling
      `createStore({ path: <dir>/copy.json }).list()` gives the same items;
      `export extra` exits `2`; a `not json` file makes `export` exit `1` with
      empty stdout and stderr starting `banny: `; `GET /export` answers `200`,
      `content-type` starting `application/json; charset=utf-8`, `content-disposition`
      equal to `attachment; filename="banny-export.json"`, and body text equal
      to the CLI `export` stdout for the same file; `GET /export` over a
      `not json` file answers `500` and the file still reads `not json`.
- [x] 1.4 [req: *] Run `npm test` and observe the new and updated tests fail
      because the verbs and `src/routes/export.js` do not exist.

## 2. Export route

- [x] 2.1 [req: export-document, export-route] Create `src/routes/export.js`
      importing `express`. Export
      `function serializeExport(items) { return JSON.stringify({ items }, null, 2) + "\n"; }`.
      Default-export `(store) => { const router = express.Router(); ... return router; }`
      registering `GET /export` with handler
      `(req, res, next) => Promise.resolve().then(async () => { const items = await store.list(); res.attachment("banny-export.json"); res.type("application/json"); res.send(serializeExport(items)); }).catch(next)`.
- [x] 2.2 [req: export-route] In `src/app.js`, import the default export of
      `./routes/export.js` as `exportRouter`. Add
      `app.use(exportRouter(store))` on the line directly after
      `app.use(tagsRouter(store))`; if that line does not exist, directly
      after `app.use(itemsRouter(store))`. Change nothing else.

## 3. CLI verbs

- [x] 3.1 [req: seed-verb] In `bin/banny.js`, import `serializeExport` from
      `src/routes/export.js` (imported with a relative path from the test file). Add
      `const SAMPLE_ITEMS = Object.freeze([{ title: "Peel the bananas", tags: ["kitchen"] }, { title: "Buy more bananas", tags: ["shop", "kitchen"] }, { title: "Water the banana plant", tags: ["garden"] }, { title: "Write the board README", done: true, tags: ["docs"] }, { title: "Plan the banana bread bake-off" }])`.
- [x] 3.2 [req: seed-verb, seed-export-commands] In `bin/banny.js`, add a
      `seed` entry to `commands` after `remove`: usage `banny seed`, options
      `{}`, `run` throws `UsageError("seed takes no arguments")` when
      `args.length > 0`; if `(await store.list()).length > 0`, returns
      `{ json: { items: [] }, text: "store is not empty; nothing seeded" }`;
      otherwise sets `inputs = SAMPLE_ITEMS.map((s) => validateNewItem(s))`,
      then awaits `store.create(input)` for each input in order into `items`,
      and returns `{ json: { items }, text: items.map(formatItem).join("\n") }`.
- [x] 3.3 [req: export-verb, export-document, seed-export-commands] In
      `bin/banny.js`, add an `export` entry after `seed`: usage
      `banny export`, options `{}`, `run` throws
      `UsageError("export takes no arguments")` when `args.length > 0`, then
      `const items = await store.list()` and returns
      `{ json: { items }, text: serializeExport(items).trimEnd() }`.

## 4. Verify

- [x] 4.1 [req: *] Run `npm test` and confirm every test passes, including the
      existing cli, items, store, and app tests. Then with
      `BANNY_DATA=<tmp>/banny.json` run `node bin/banny.js seed`,
      `node bin/banny.js export`, and `PORT=4399 npm start` followed by
      `curl -si http://127.0.0.1:4399/export`; confirm five items, matching
      bodies, and the `Content-Disposition` header, then stop the server.
