## 1. Tests first

- [x] 1.1 [req: item-validation] Create `test/items.test.js` using `node:test`
      and `node:assert/strict`. Import `validateNewItem`, `validateItemPatch`,
      and `ItemValidationError` from `../src/items.js`. Assert
      `validateNewItem({ title: "  milk  " })` deep-equals
      `{ title: "milk", done: false, tags: [] }`; assert each of `[]`, `null`,
      `{}`, `{ title: "   " }`, `{ title: "a".repeat(201) }`,
      `{ title: "a", done: "yes" }`, `{ title: "a", tags: "x" }`,
      `{ title: "a", tags: ["Bad Tag"] }`, `{ title: "a", tags: ["x", "x"] }`,
      eleven distinct tags `t0`..`t10`, and `{ title: "a", id: "x" }` throws an
      `ItemValidationError` with `code === "invalid-item"`; assert
      `validateNewItem({ title: "a".repeat(200), tags: ["a-1"] })` succeeds;
      assert `validateItemPatch({ done: true })` deep-equals `{ done: true }`,
      `validateItemPatch({ title: " b " })` deep-equals `{ title: "b" }`, and
      `validateItemPatch({})` and `validateItemPatch({ createdAt: "y" })`
      throw `ItemValidationError`.
- [x] 1.2 [req: items-routes] In `test/items.test.js`, add a helper that makes
      a `fs.mkdtemp(path.join(os.tmpdir(), "banny-"))` directory, builds
      `createApp({ store: createStore({ path: <dir>/banny.json }) })` (imports
      from `../src/app.js` and `../src/store.js`), listens on port 0 at
      `127.0.0.1`, and returns the base URL and the server; close every
      server in `after` or `finally`. Add tests: `POST /items` with header
      `content-type: application/json` and body
      `{"title":"milk","tags":["shop"]}` answers `201`, `Location` equals
      `/items/<id>`, and the body has `title "milk"`, `done false`,
      `tags ["shop"]`, and string `createdAt`/`updatedAt`; `GET /items/<id>`
      answers `200` with the same body; `GET /items` answers `200` with
      `{ items: [<that item>] }`; `PATCH /items/<id>` with `{"done":true}`
      answers `200` with `done true` and title `milk`; `DELETE /items/<id>`
      answers `204` with body text `""`; a following `GET /items/<id>`
      answers `404` with `error.code === "not-found"`; `GET`, `PATCH`
      (`{"done":true}`), and `DELETE` on `/items/no-such-id` each answer `404`
      `not-found`; `POST /items` with `{"title":""}` answers `400`
      `invalid-item` and `GET /items` then answers `{ items: [] }`; `PATCH`
      with `{}` on an existing item answers `400` `invalid-item`.
- [x] 1.3 [req: json-bodies] In `test/items.test.js`, add tests: `POST /items`
      with `content-type: application/json` and body `{bad` answers `400`
      with body `{ error: { code: "invalid-json", message: <string> } }`;
      `POST /items` with `content-type: application/json` and
      `JSON.stringify({ title: "a", pad: "x".repeat(200000) })` answers `400`
      `invalid-json`;
      `POST /items` with `content-type: text/plain` and body
      `{"title":"milk"}` answers `415` `unsupported-media-type`; `POST /items`
      with no body and no content type answers `415`; `PATCH /items/<id>` on
      an existing item with `content-type: text/plain` answers `415` and a
      following `GET /items/<id>` shows the item unchanged; `POST /items`
      with `content-type: application/json; charset=utf-8` and a valid body
      answers `201`.
- [x] 1.4 [req: item-validation, items-routes, json-bodies] Run `npm test` and
      observe the new tests fail because `src/items.js` and
      `src/routes/items.js` do not exist.

## 2. Validator

- [x] 2.1 [req: item-validation] Create `src/items.js` exporting
      `class ItemValidationError extends Error` whose constructor takes a
      message, sets `this.name = "ItemValidationError"` and
      `this.code = "invalid-item"`. Add private checks: input is a plain
      object (`typeof input === "object"`, not `null`, not
      `Array.isArray`), else throw `"item must be a JSON object"`; every key is
      one of `title`, `done`, `tags`, else throw `"unknown field: <key>"`;
      `title` is a string whose `.trim()` length is 1 to 200, else throw
      `"title must be a string of 1 to 200 characters"`; `done` is a boolean,
      else throw `"done must be a boolean"`; `tags` is an array of at most 10
      strings, each matching `/^[a-z0-9]+(-[a-z0-9]+)*$/`, with no duplicate,
      else throw a message starting `"tags "` that names the fault.
- [x] 2.2 [req: item-validation] In `src/items.js`, export
      `validateNewItem(input)`: run the object and key checks, throw
      `"title is required"` when `title` is absent, check each present field,
      and return `{ title: title.trim(), done: done ?? false, tags: tags ?? [] }`
      with `tags` copied. Export `validateItemPatch(input)`: run the object
      and key checks, throw `"patch must set title, done, or tags"` when none
      of the three keys is present, check each present field, and return an
      object holding only the present keys, `title` trimmed and `tags` copied.

## 3. Router

- [x] 3.1 [req: items-routes, json-bodies] Create `src/routes/items.js` with a
      default export `(store) => Router`. Define `sendError(res, status, code,
      message)` that sends `res.status(status).json({ error: { code, message } })`;
      `wrap(fn)` returning `(req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)`;
      and `requireJson(req, res, next)` that calls `sendError(res, 415,
      "unsupported-media-type", "request body must be application/json")`
      when `!req.is("application/json")`, else `next()`.
- [x] 3.2 [req: items-routes] In `src/routes/items.js`, register:
      `GET /items` → `res.json({ items: await store.list() })`;
      `POST /items` with `requireJson, express.json(), wrap(...)` →
      `store.create(validateNewItem(req.body))`, then
      `res.status(201).location("/items/" + item.id).json(item)`;
      `GET /items/:id` → `store.get(id)`, `404 not-found` with message
      `"no item with id <id>"` on `null`, else `res.json(item)`;
      `PATCH /items/:id` with `requireJson, express.json(), wrap(...)` →
      `store.update(id, validateItemPatch(req.body))`, `404` on `null`, else
      `res.json(item)`; `DELETE /items/:id` → `store.remove(id)`, `404` on
      `false`, else `res.status(204).end()`. Wrap every handler in `wrap`.
- [x] 3.3 [req: json-bodies, items-routes] At the end of the router in
      `src/routes/items.js`, add `router.use((err, req, res, next) => ...)`:
      when `err.type === "entity.parse.failed"`, `sendError(res, 400,
      "invalid-json", "request body is not valid JSON")`; else when
      `typeof err.type === "string"` and `err.status` is from 400 to 499 (any
      other body-parser rejection, such as `entity.too.large`),
      `sendError(res, 400, "invalid-json", "request body could not be read
      as JSON")`; when
      `err instanceof ItemValidationError`, `sendError(res, 400,
      "invalid-item", err.message)`; otherwise `next(err)`.

## 4. Wiring

- [x] 4.1 [req: items-routes] In `src/app.js`, import the default export of
      `./routes/items.js` as `itemsRouter` and add
      `app.use(itemsRouter(store))` on the line directly after
      `app.use(healthRouter(store))`. Change nothing else in the file.
- [x] 4.2 [req: server-store] In `src/server.js`, import `createStore` from
      `./store.js`, and in the entry-point guard replace `startServer()` with
      `startServer({ store: createStore() })`. Leave `startServer`'s signature
      and defaults unchanged.

## 5. Verify

- [x] 5.1 [req: *] Run `npm test` and confirm every test passes, including
      `test/app.test.js`, `test/store.test.js`, and `test/smoke.test.js`. Then
      run `BANNY_DATA=<tmp>/banny.json PORT=4399 npm start`, send
      `curl -s -X POST -H 'content-type: application/json' -d '{"title":"milk"}' http://127.0.0.1:4399/items`,
      confirm a `201` item and that `<tmp>/banny.json` holds it, then stop the
      server.
