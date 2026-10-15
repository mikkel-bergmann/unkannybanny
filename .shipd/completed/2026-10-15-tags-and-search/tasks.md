## 1. Tests first

- [x] 1.1 [req: items-filters, items-filters-invalid, tags-route] Create
      `test/tags.test.js` using `node:test` and `node:assert/strict`. Import
      `filterItems`, `countTags`, and `InvalidQueryError` from
      `src/routes/tags.js` (imported with a relative path from the test file). Build three plain items `milk` (tags
      `["shop","food"]`), `bread` (`["shop"]`), and `call mum` (`[]`), each
      with an `id`. Assert `filterItems(items, {})` returns all three in order;
      `{ tag: "shop" }` returns milk and bread; `{ tag: ["shop","food"] }`
      returns milk; `{ q: " MIL " }` returns milk; `{ q: "  " }` returns all
      three; `{ q: "br", tag: "food" }` returns `[]`; `{ other: "x" }` returns
      all three. Assert each of `{ tag: "Bad Tag" }`, `{ tag: "" }`,
      `{ tag: { x: "y" } }`, `{ tag: ["shop", 1] }`, and `{ q: ["a","b"] }`
      throws an `InvalidQueryError` with `code === "invalid-query"` and
      `status === 400`. Assert `countTags(items)` deep-equals
      `[{ tag: "food", count: 1 }, { tag: "shop", count: 2 }]` and
      `countTags([])` deep-equals `[]`.
- [x] 1.2 [req: items-filters, items-filters-invalid, tags-route] In
      `test/tags.test.js`, add a helper that makes a
      `fs.mkdtemp(path.join(os.tmpdir(), "banny-"))` directory, builds
      `createApp({ store: createStore({ path: <dir>/banny.json }) })`
      (imports from `../src/app.js` and `../src/store.js`), listens on port 0
      at `127.0.0.1`, and returns the base URL and the server; close every
      server in `after` or `finally`. Seed the three items through
      `POST /items` with `content-type: application/json`. Assert:
      `GET /items?tag=shop` answers `200` with titles `["milk","bread"]`;
      `GET /items?tag=shop&tag=food` with `["milk"]`; `GET /items?q=%20MIL%20`
      with `["milk"]`; `GET /items?q=` with all three; `GET /items?q=br&tag=food`
      with body `{ items: [] }`; each of `GET /items?tag=Bad%20Tag`,
      `GET /items?tag=`, `GET /items?tag[x]=y`, and `GET /items?q=a&q=b`
      answers `400` with `error.code === "invalid-query"` and a string
      `error.message`; `GET /tags` answers `200` with
      `{ tags: [{ tag: "food", count: 1 }, { tag: "shop", count: 2 }] }`; and
      `GET /tags` on a fresh empty store answers `200` with `{ tags: [] }`.
- [x] 1.3 [req: items-filters, items-filters-invalid, tags-route] Run
      `npm test` and observe the new tests fail because `src/routes/tags.js`
      does not exist.

## 2. Helpers and tags router

- [x] 2.1 [req: items-filters, items-filters-invalid] Create
      `src/routes/tags.js`. Export `class InvalidQueryError extends Error`
      whose constructor takes a message and sets
      `this.name = "InvalidQueryError"`, `this.code = "invalid-query"`, and
      `this.status = 400`. Define `const TAG_PATTERN =
      /^[a-z0-9]+(-[a-z0-9]+)*$/`. Export `filterItems(items, query)`:
      `tags = query.tag === undefined ? [] : [].concat(query.tag)`; throw
      `new InvalidQueryError("tag must be a kebab-case tag")` when any entry
      is not a string or fails `TAG_PATTERN`; when `query.q !== undefined`
      and `typeof query.q !== "string"`, throw
      `new InvalidQueryError("q must be a single string")`; let
      `needle = (query.q ?? "").trim().toLowerCase()`; return
      `items.filter(item => tags.every(t => item.tags.includes(t)) &&
      (needle === "" || item.title.toLowerCase().includes(needle)))`.
- [x] 2.2 [req: tags-route] In `src/routes/tags.js`, export
      `countTags(items)`: count each tag across `items` in a `Map`, and return
      `[...map].map(([tag, count]) => ({ tag, count }))` sorted by
      `(a, b) => (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0)`.
- [x] 2.3 [req: tags-route] In `src/routes/tags.js`, add the default export
      `(store) => Router` (import `express` from `"express"`) registering
      `GET /tags` with handler `(req, res, next) =>
      store.list().then(items => res.json({ tags: countTags(items) }), next)`.

## 3. Wiring

- [x] 3.1 [req: items-filters, items-filters-invalid] In
      `src/routes/items.js`, import `{ filterItems, InvalidQueryError }` from
      `./tags.js`. Change the `GET /items` handler body to
      `res.json({ items: filterItems(await store.list(), req.query) })`,
      keeping it wrapped in `wrap`. In the router's error middleware, before
      the final `next(err)`, add: when `err instanceof InvalidQueryError`,
      `sendError(res, 400, "invalid-query", err.message)`. Change nothing else
      in the file.
- [x] 3.2 [req: tags-route] In `src/app.js`, import the default export of
      `./routes/tags.js` as `tagsRouter` and add
      `app.use(tagsRouter(store))` on the line directly after
      `app.use(itemsRouter(store))`. Change nothing else in the file.

## 4. Verify

- [x] 4.1 [req: *] Run `npm test` and confirm every test passes, including
      `test/items.test.js`. Then run `BANNY_DATA=<tmp>/banny.json PORT=4399
      npm start`, create two items with `curl -s -X POST -H 'content-type:
      application/json'` (`{"title":"milk","tags":["shop"]}` and
      `{"title":"bread"}`), confirm `curl -s
      'http://127.0.0.1:4399/items?tag=shop'` lists only milk and
      `curl -s http://127.0.0.1:4399/tags` answers
      `{"tags":[{"tag":"shop","count":1}]}`, then stop the server.
