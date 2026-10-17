## 1. Store columns

- [x] 1.1 [req: store-read, store-columns] In `test/store.test.js`, add tests
      over a temp data file: `listColumns()` is `[]` for a missing file and for
      a file holding only `{"items": [...]}`; `createColumn({ name: "Backlog" })`
      returns a UUID `id` with equal ISO `createdAt`/`updatedAt` and lands in
      the file; `updateColumn` changes only `name` and `updatedAt`;
      `removeColumn` on a column an item references resolves `true`, drops the
      column, and sets that item's `columnId` to `null`; `reorderColumns`
      applies a permutation and resolves `null` for `["a"]` and `["a","a"]`;
      `getColumn` and returned columns are copies. Run `npm test` and observe
      these fail.
- [x] 1.2 [req: store-read, store-columns] In `src/store.js`, load a `columns`
      array from the data file (absent reads as `[]`) alongside `items`; persist
      the `columns` key only when at least one column exists, so a board with no
      columns still writes the original `{"items": [...]}` shape; and add
      `listColumns`, `getColumn`, `createColumn`, `updateColumn`,
      `removeColumn`, and `reorderColumns` to the returned object, each running
      through the existing queue and `commit` so `removeColumn` unassigns items
      in the same write and `reorderColumns` returns `null` on a non-permutation.
      Add `columnId` to the item `create` and `update` shapes.

## 2. Item validation

- [x] 2.1 [req: item-validation] In `test/items.test.js`, add assertions that
      `validateNewItem({ title: "milk" })` returns `columnId: null`,
      `validateNewItem({ title: "milk", columnId: "c1" })` keeps `"c1"`,
      `validateItemPatch({ columnId: null })` returns `{ columnId: null }`, and
      `{ title: "a", columnId: "" }` throws `ItemValidationError`. Run
      `npm test` and observe these fail.
- [x] 2.2 [req: item-validation] In `src/items.js`, add `columnId` to `KEYS`,
      add a `checkColumnId` accepting `null` or a non-empty string, default
      `columnId` to `null` in `validateNewItem`, and copy `columnId` in
      `validateItemPatch`.

## 3. Columns API

- [x] 3.1 [req: column-validation, columns-routes] Create
      `test/columns.test.js` using `node:test` and `node:assert/strict`. Unit
      tests: `validateNewColumn({ name: "  Doing  " })` returns
      `{ name: "Doing" }`; each of `[]`, `{}`, `{ name: "   " }`, a 101-char
      name, `{ name: 1 }`, and `{ name: "a", id: "x" }` throws
      `ColumnValidationError` with `code` `invalid-column`; `validateColumnPatch({})`
      throws. HTTP tests over `createApp({ store: createStore({ path }) })` on
      port 0: create answers `201` with a `Location` header and a column;
      `GET /columns` lists it; `PATCH` renames; `DELETE` answers `204`; a bad
      `PUT /columns/order` answers `400` `invalid-column`; `PATCH`/`DELETE` to an
      unknown id answer `404`; `POST` with `Content-Type: text/plain` answers
      `415`. Run `npm test` and observe these fail.
- [x] 3.2 [req: column-validation] Create `src/columns.js` exporting
      `validateNewColumn`, `validateColumnPatch`, and `ColumnValidationError`
      (`code` `invalid-column`), mirroring `src/items.js`: a plain object only, a
      `name` key only, and a trimmed `name` string of 1 to 100 characters.
- [x] 3.3 [req: columns-routes] Create `src/routes/columns.js`: a default
      `(store) => Router` serving `GET /columns`, `POST /columns`,
      `PATCH /columns/:id`, `DELETE /columns/:id`, and `PUT /columns/order`,
      with `express.json()` and the `415 unsupported-media-type` / `400
      invalid-json` body handling, `404 not-found` for an unknown id, and `400
      invalid-column` for a validation throw or a non-permutation order.
- [x] 3.4 [req: columns-routes] In `src/app.js`, import the columns router and
      add `app.use(columnsRouter(store))` directly after `app.use(tagsRouter(store))`
      and before the export router. Change nothing else in the file.

## 4. Items route column check

- [x] 4.1 [req: items-routes] In `test/items.test.js`, add HTTP tests: create a
      column, `POST /items` with its id answers `201` with that `columnId`;
      `POST /items` with `columnId: "nope"` answers `400` `invalid-item` and
      stores nothing; `PATCH /items/<id>` with `{"columnId": null}` answers `200`
      with `columnId: null`. Run `npm test` and observe these fail.
- [x] 4.2 [req: items-routes] In `src/routes/items.js`, on `POST` and `PATCH`
      resolve a non-null `columnId` through `store.getColumn` and, when it names
      no column, answer `400` `invalid-item` before mutating. Change nothing
      else in the file.

## 5. Board page

- [x] 5.1 [req: board-page-markup, board-list-filter, board-columns] In
      `test/board.test.js`, add `column-add-form` and `column-add-name` to the
      fixed-id list, require the inline script to contain `"/columns"`, and keep
      the single-script, no-`src=`, no-`innerHTML`, and `vm.Script` compile
      assertions. Run `npm test` and observe these fail.
- [x] 5.2 [req: board-page-markup, board-columns] In `public/index.html`, add
      the add-column form, render lanes into `#item-list` with a lane header
      holding an editable name input, `◀`/`▶` reorder buttons (disabled at the
      ends), and a `✕` remove button, and make each card draggable with a drop
      handler that sends `PATCH /items/<id>` with the lane's `columnId`. Wire
      create, rename, reorder, and remove to the columns API, keep the single
      inline script, no `innerHTML`, and no external resource, and show an API
      error's `message` in `#status`.
- [x] 5.3 [req: board-list-filter] In `public/index.html`, fetch `/columns` and
      group the fetched items into a lane per column in order plus a trailing
      `Unassigned` lane, keeping the tag filter and the `textContent` rendering
      of title, done checkbox, and tags.

## 6. CLI verbs

- [x] 6.1 [req: cli-columns] In `test/cli.test.js`, add tests: `columns` prints
      nothing on an empty board; `column add Doing` prints `<id>  Doing` and
      writes the column; `column move <b> 1` reorders; `column rename` and
      `column remove` update the file and exit `0`; `move <item> <column>` sets
      `columnId`; `move <item> --none` clears it; an unknown column or item exits
      `4`; a bad position exits `2`. In `test/seed.test.js`, extend the
      verb-table assertion to the ten keys in order. Run `npm test` and observe
      these fail.
- [x] 6.2 [req: cli-columns] In `bin/banny.js`, add `columns`, `column`, and
      `move` entries to `commands`: `columns` prints `<id>  <name>` per column;
      `column` dispatches `add`, `rename`, `move` (1-based), and `remove`;
      `move` sets an item's `columnId` with a `--none` flag to clear it. Reuse
      `validateNewColumn`, `validateColumnPatch`, and `validateItemPatch`, and
      the existing exit codes.

## 7. Export carries columns

- [x] 7.1 [req: export-document, export-verb, export-route] In
      `test/export.test.js`, add a test that a store holding items and a column
      exports a document whose text equals the data file and reloads with
      `createStore(...).listColumns()` returning the column. Run `npm test` and
      observe it fail.
- [x] 7.2 [req: export-document, export-route] In `src/routes/export.js`, change
      `serializeExport(items, columns = [])` to include `columns` when it is
      non-empty and to omit it when empty, and have the `GET /export` handler
      read `store.listColumns()` and pass it through.
- [x] 7.3 [req: export-verb] In `bin/banny.js`, have the `export` command read
      `store.listColumns()` and pass it to `serializeExport`, and include
      `columns` in the `--json` object only when it is non-empty.

## 8. Verify

- [x] 8.1 [req: *] Run `npm test` and confirm every test passes. Then run
      `BANNY_DATA=<tmp>/banny.json PORT=4399 npm start`, create two columns and
      two items with `curl -s -X POST -H 'content-type: application/json'`,
      reorder the columns, move an item into a column, confirm `GET /columns`
      and `GET /items` reflect it, delete a column and confirm its item's
      `columnId` is `null`, then stop the server.
