## 1. Store checks inside the move write

- [x] 1.1 [req: store-item-order] In `test/store.test.js`, import
      `ItemReferenceError` from `../src/items.js` and add tests over a temp
      data file: column `k` holds `a`, `x` is unassigned, `remove(a)` then
      `moveItem(x, { columnId: k, before: a })` started without awaiting
      between them: the move rejects with an `ItemReferenceError` whose
      `reason` is `before-missing` and `code` is `invalid-item`, and the file
      text equals the text after the remove; `moveItem(a, { columnId: m,
      before: null })` then `moveItem(x, { columnId: k, before: a })` started
      without awaiting: the second rejects with `before-lane` and `x` keeps
      `columnId` `null`; `moveItem(a, { columnId: k, before: a })` rejects
      `before-self`, `moveItem(a, { columnId: "nope", before: null })` rejects
      `column`, and `moveItem("no-such-id", { columnId: null, before: a })`
      rejects `before-lane` with `itemMissing` `true`, each leaving the file
      text unchanged; a later `moveItem` still resolves. Run `npm test` and
      observe the new tests fail.
- [x] 1.2 [req: store-item-order] In `src/items.js`, export
      `class ItemReferenceError extends ItemValidationError` with
      `constructor(reason, ref, message, itemMissing = false)` that calls
      `super(message)` and sets `this.reason`, `this.ref`, and
      `this.itemMissing`; do not override `name`.
- [x] 1.3 [req: store-item-order] In `src/store.js`, import
      `ItemReferenceError` instead of `ItemValidationError`; have
      `checkColumn` throw `new ItemReferenceError("column", columnId,
      "columnId names no column: " + columnId)`. In `moveItem`, inside `run`:
      call `checkColumn(columnId)` first; then when `before != null`, compute
      `itemMissing = !items.some((i) => i.id === id)`, find the target and
      throw `before-missing` ("before names no item: " + before), then
      `before-self` when `before === id` ("before must not be the moved
      item"), then `before-lane` when `target.columnId !== (columnId ??
      null)` ("before names an item in another column"), each passing
      `itemMissing`; only then look up the moved item and resolve `null` when
      absent. Keep the splice, with `at` found by `before`'s index. Confirm
      the 1.1 tests pass.

## 2. Move route

- [x] 2.1 [req: items-move] In `test/items.test.js`, add a test: a store
      with column `k` holding `a` and unassigned `x`, wrapped as
      `{ ...store, moveItem }` whose `moveItem` first starts
      `store.remove(a.id)` and then returns `store.moveItem(id, input)`;
      "POST /items/<x>/move" with `{"columnId":"<k>","before":"<a>"}` answers
      `400`, code `invalid-item`, message "before names no item: <a>", and
      `x` keeps `columnId` `null`. Run `npm test` and observe it fail.
- [x] 2.2 [req: items-move] In `src/routes/items.js`, in the move route
      delete the `requireColumn` call and the whole `before` block, leaving
      `validateItemMove`, `store.moveItem`, and the `null`-is-404 line.
      Leave `requireColumn` and its create and PATCH calls in place. Confirm
      the existing move tests and 2.1 pass.

## 3. CLI move

- [x] 3.1 [req: cli-columns] In `test/cli.test.js`, import `main` from
      `../bin/banny.js` and add a test: column `c` holds `a`, `x` is
      unassigned, a store wrapped so `moveItem` first starts
      `store.remove(a.id)`; `main(["move", x.id, c.id, "--before", a.id],
      { stdout, stderr, store: wrapped })` returns `4`, stderr includes
      "no item with id <a>", and `x` keeps `columnId` `null`. Also assert,
      over the real binary, that `banny move no-such-item <c> --before
      <an item in another lane>` exits `4` naming "no-such-item", and that
      the self and other-lane `--before` messages are "--before must not be
      the moved item" and "--before names an item in another lane". Run
      `npm test` and observe the race test fail.
- [x] 3.2 [req: cli-columns] In `bin/banny.js` `move.run`, delete the
      `getColumn` and `get` pre-reads and the `before` block; call
      `store.moveItem(id, { columnId, before })` in a `try` and map an
      `ItemReferenceError`: reason `column` to `NotFoundError("no column with
      id " + columnId)`; any `before-*` with `itemMissing` to
      `NotFoundError("no item with id " + id)`; `before-missing` to
      `NotFoundError("no item with id " + before)`; `before-self` to
      `ItemValidationError("--before must not be the moved item")`;
      `before-lane` to `ItemValidationError("--before names an item in
      another lane")`; rethrow anything else. Keep the `null`-is-not-found
      line. Replace the `validateItemMove` import with `ItemReferenceError`.
      Confirm the CLI tests pass.

## 4. Verify

- [x] 4.1 [req: *] Run `npm test` and confirm every test passes, and
      `node bin/banny.js --help` still exits `0` with the `move` usage.
