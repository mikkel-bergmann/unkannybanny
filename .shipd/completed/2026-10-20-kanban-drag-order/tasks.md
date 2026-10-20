## 1. Store card order

- [x] 1.1 [req: store-item-order] In `test/store.test.js`, add tests over a temp
      data file: with items `a`, `b`, `c` in column `k`,
      `moveItem(c, { columnId: k, before: a })` resolves to `c` and `list()`
      returns `c`, `a`, `b`; with `a`, `b` in `k` and `x` in `m`,
      `moveItem(x, { columnId: k, before: b })` gives `a`, `x`, `b` and `x`
      has `columnId` `k`; `moveItem(a, { columnId: null, before: null })` on
      two unassigned items gives `b`, `a`; `moveItem("no-such-id", ...)`
      resolves `null` and the file text is unchanged; a hand-written
      `{"items": [a, b, c]}` file lists `a`, `b`, `c` and its text is not
      rewritten. Run `npm test` and observe the move tests fail.
- [x] 1.2 [req: store-item-order] In `src/store.js`, add `moveItem(id,
      { columnId, before } = {})` to the returned object, running through
      `run` and `commit`: find the item (resolve `null` if absent), build the
      array without it, set `columnId` and a fresh `updatedAt` on a copy,
      insert it before the index of `before` when `before` names another
      item, else push it at the end, and resolve to a `structuredClone`.
      Change nothing else in the file.

## 2. Move route

- [x] 2.1 [req: items-move] In `test/items.test.js`, add unit tests:
      `validateItemMove({ columnId: "c" })` returns
      `{ columnId: "c", before: null }`; each of `{}`, `{ columnId: "" }`,
      `{ columnId: null, before: 1 }`, `{ columnId: null, title: "x" }`, and
      `[]` throws `ItemValidationError`. Add HTTP tests: column `k` with `a`
      then `b` and unassigned `x`; `POST /items/<x>/move` with
      `{"columnId":<k>,"before":<b>}` answers `200` with `columnId` `<k>` and
      `GET /items` lists `a`, `x`, `b`; `before` equal to the id, `before`
      in another column, and `{"columnId":"nope"}` each answer `400`
      `invalid-item` with `GET /items` unchanged; `POST /items/no-such-id/move`
      with `{"columnId":null}` answers `404`; a the MIME string "text/plain" body answers
      `415`. Run `npm test` and observe these fail.
- [x] 2.2 [req: items-move] In `src/items.js`, export
      `validateItemMove(input)`: a plain object with only `columnId` and
      `before` keys, `columnId` required, each checked with the existing
      `checkColumnId` rule (`null` or non-empty string), returning
      `{ columnId, before: before ?? null }`, throwing `ItemValidationError`
      with a message naming the field.
- [x] 2.3 [req: items-move] In `src/routes/items.js`, add
      `router.post("/items/:id/move", requireJson, express.json(), ...)`
      before the error middleware: run `validateItemMove`, `requireColumn`,
      then when `before` is non-null read it with `store.get` and throw
      `ItemValidationError` when it is missing, equals `req.params.id`, or has
      a `columnId` different from the input's; then `store.moveItem` and
      answer `404` via `notFound` on `null`, else `200` with the item.

## 3. Board page

- [x] 3.1 [req: board-columns] In `test/board.test.js`, add a test that the
      inline script contains `"/move"`, the MIME string "application/x-banny-item",
      the MIME string "application/x-banny-column", and `lane-grip`, keeping the existing
      single-script, banned-string, and `vm.Script` assertions. Run
      `npm test` and observe it fail.
- [x] 3.2 [req: board-columns] In `public/index.html` `renderCard`, set
      the MIME string "application/x-banny-item" (not the MIME string "text/plain") on `dragstart`, and add a
      card `dragover` and `drop`: on `drop` with that type, call
      `preventDefault` and `stopPropagation`, and when the dragged id differs
      from the card's id call a new `moveItem(id, columnId, before)` with the
      card's lane column id (`null` for Unassigned) and the card's id. Pass
      the lane's column id into `renderCard` from `renderLane`.
- [x] 3.3 [req: board-columns] In `public/index.html`, change `moveItem` to
      send `POST /items/<id>/move` with `{ columnId, before }`, and change the
      lane `drop` handler to send `before: null` for the item type. Have the
      lane `dragover` call `preventDefault` only when
      `event.dataTransfer.types` includes either drag type.
- [x] 3.4 [req: board-columns] In `public/index.html` `renderLane`, prepend a
      `span` with class `lane-grip`, text `☰`, `draggable = true`, and
      `title` `Drag to reorder` to each column header, whose `dragstart` sets
      the MIME string "application/x-banny-column" to the column id. In the lane `drop`
      handler, for the column type find the dragged column's index in
      `orderedColumns` and call `moveColumn(from, to, orderedColumns)` with
      `to` the lane's index, or the last index for the Unassigned lane, and
      skip when `from === to`. Keep the `◀`/`▶`/`✕` buttons and add a
      `.lane-grip { cursor: grab; }` style.

## 4. CLI move

- [x] 4.1 [req: cli-columns] In `test/cli.test.js`, add tests: column `c`
      holds `milk` then `bread`, `banny move <bread> <c> --before <milk>`
      exits `0` and `banny list` prints `bread` before `milk`; an earlier
      unassigned `eggs` moved with `banny move <eggs> <c>` lands after `milk`
      in the file's `items` array; `--before` naming the item itself or an
      item in another lane exits `3` and `--before no-such-item` exits `4`,
      each leaving the file text unchanged. Keep the existing move tests. Run
      `npm test` and observe the new tests fail.
- [x] 4.2 [req: cli-columns] In `bin/banny.js`, add
      `before: { type: "string" }` to the `move` options, update its usage to
      `banny move <item-id> <column-id> | <item-id> --none [--before <item-id>]`,
      import `validateItemMove`, and have `run` check the column, the item
      (`store.get`), and the `--before` item (exit `4` via `NotFoundError`),
      throw `ItemValidationError` for a self or other-lane `--before`, then
      call `store.moveItem(id, validateItemMove({ columnId, before }))`.

## 5. Verify

- [x] 5.1 [req: *] Run `npm test` and confirm every test passes. Then run
      `BANNY_DATA=<tmp>/banny.json PORT=4399 npm start`, create a column and
      three items in it with `curl`, `POST /items/<third>/move` with
      `before` the first, confirm `GET /items` and `GET /export` list the
      new order, and stop the server.
