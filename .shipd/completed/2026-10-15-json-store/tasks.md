## 1. Tests first

- [x] 1.1 [req: store-factory, store-read, store-mutations] Create
      `test/store.test.js` using `node:test` and `node:assert/strict`. Each test
      makes its own directory with `fs.mkdtemp(path.join(os.tmpdir(), "banny-"))`
      and calls `createStore({ path: <dir>/banny.json })`. Cover: explicit path
      wins (nothing written under `data/`); `BANNY_DATA` set to a temp file and
      `createStore()` with no argument writes there (restore the variable after);
      missing file lists `[]` and is not created; `get("no-such-id")` is `null`;
      mutating a returned item does not change the next `list()`; `create`
      assigns a UUID matching
      `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/` and equal
      ISO `createdAt`/`updatedAt`; `update(id, { done: true, id: "x", createdAt: "y" })`
      keeps `id` and `createdAt`; `update`/`remove` of an unknown id resolve to
      `null`/`false` and leave the file bytes unchanged.
- [x] 1.2 [req: store-atomic-write, store-reload, store-corrupt] In
      `test/store.test.js`, add: 50 `create` calls started together via
      `Promise.all` leave 50 distinct items in the parsed file and in `list()`;
      after create, update, and remove settle, `fs.readdir(<dir>)` returns only
      `["banny.json"]`; after one `create`, an outside
      `fs.writeFile(<file>, JSON.stringify({ items: [two other items] }))` makes
      the next `list()` return those two items; a file holding `not json`
      makes `create` reject with `code === "store-corrupt"` and a message
      containing the path, and the file still reads `not json`; a file holding
      `{}` makes `list()` reject with `code === "store-corrupt"`. Run
      `npm test` and observe these tests fail because `src/store.js` does not
      exist.

## 2. Store

- [x] 2.1 [req: store-factory] Add `data/` as a line in `.gitignore`.
- [x] 2.2 [req: store-factory, store-read] Create `src/store.js` exporting
      `createStore({ path } = {})`. Resolve the file as
      `path.resolve(path ?? process.env.BANNY_DATA ?? "data/banny.json")`.
      Keep `items` (array), `loadedStat` (`{ mtimeMs, size }` or `null`), and a
      `queue` promise initialised to `Promise.resolve()`. Implement
      `refresh()`: `fs.stat` the file; on `ENOENT` set `items = []` and
      `loadedStat = null`; otherwise, when `loadedStat` is `null` or its
      `mtimeMs` or `size` differs, read and `JSON.parse` the file, and if
      parsing throws or `Array.isArray(data?.items)` is false throw an `Error`
      with message `store-corrupt: <file> is not a {"items": [...]} JSON file`
      and `code = "store-corrupt"`; else set `items = data.items` and
      `loadedStat` from the stat.
- [x] 2.3 [req: store-atomic-write] In `src/store.js`, implement
      `run(op)`: `const result = queue.then(async () => { await refresh(); return op(); });`
      then `queue = result.catch(() => {});` and return `result`. Implement
      `persist()`: `fs.mkdir(dirname(file), { recursive: true })`; write
      `JSON.stringify({ items }, null, 2) + "\n"` to
      `<file>.<process.pid>.<crypto.randomUUID()>.tmp`; `fs.rename` it over the
      file; on any error `fs.rm(tmp, { force: true })` and rethrow; on success
      set `loadedStat` from a fresh `fs.stat(file)`.
- [x] 2.4 [req: store-read, store-mutations] In `src/store.js`, return the
      object `{ path: file, list, get, create, update, remove }` where each method
      goes through `run`: `list()` returns `structuredClone(items)`; `get(id)`
      returns a clone of the match or `null`; `create({ title, done, tags })`
      builds `{ id: crypto.randomUUID(), title, done, tags, createdAt: now, updatedAt: now }`
      with `now = new Date().toISOString()`, pushes it onto a copy of `items`,
      assigns, persists, and returns a clone; `update(id, patch)` returns
      `null` for an unknown id, else copies only the `title`, `done`, `tags`
      keys present in `patch` onto a new item with `updatedAt` set to now,
      replaces it in a copy of `items`, persists, and returns a clone;
      `remove(id)` returns `false` for an unknown id, else filters it out,
      persists, and returns `true`. On a failed `persist`, restore the previous
      `items` array before rethrowing.

## 3. Verify

- [x] 3.1 [req: *] Run `npm test` and confirm every test in
      `test/store.test.js` and `test/smoke.test.js` passes, and that
      `git check-ignore data/banny.json` exits 0.
