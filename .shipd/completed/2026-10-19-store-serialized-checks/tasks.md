## 1. Store reference checks

- [x] 1.1 [req: store-reference-checks] In `src/items.js`, directly after the
      `ItemValidationError` class, add and export
      `class ItemReferenceError extends ItemValidationError` whose
      `constructor(reason, ref, message)` calls `super(message)` and sets
      `this.name = "ItemReferenceError"`, `this.reason = reason`, and
      `this.ref = ref`. Change nothing else in the file.
- [x] 1.2 [req: store-item-order] In `test/store.test.js`, in the tests
      "moveItem places an item within a lane" and "moveItem moves across lanes
      and sets the column", replace the made-up ids "col-k" and "col-m" with
      the `id` of columns made by `await store.createColumn({ name: "k" })`
      and `await store.createColumn({ name: "m" })` at the top of each test.
      Keep every assertion as it is.
- [x] 1.3 [req: store-reference-checks, store-mutations] In
      `test/store.test.js`, import `ItemReferenceError` from `../src/items.js`
      and add one test per scenario of `store-reference-checks`, each over a
      fresh temp store, starting the racing calls without `await` between
      them and asserting rejections with
      `assert.rejects(promise, (err) => err instanceof ItemReferenceError &&
      err.code === "invalid-item" && err.reason === "<reason>")`:
      (a) column `c`, unassigned item `i`: start `removeColumn(c.id)` then
      `moveItem(i.id, { columnId: c.id, before: null })`; the remove resolves
      `true`, the move rejects `column`, `get(i.id)` has `columnId` `null`;
      (b) column `c`: start `removeColumn(c.id)` then `create({ ...sample,
      columnId: c.id })`; rejects `column`, `list()` holds only the items made
      before; then with a new column `d` and item `i` made in no column,
      start `removeColumn(d.id)` then `update(i.id, { columnId: d.id })`;
      rejects `column` and `get(i.id).columnId` is `null`;
      (c) columns `k`, `m`, `a` in `k`, `x` unassigned: start
      `moveItem(a.id, { columnId: m.id, before: null })` then
      `moveItem(x.id, { columnId: k.id, before: a.id })`; the first resolves,
      the second rejects `before-lane`, `get(x.id).columnId` is `null`;
      (d) read the data file text, then `moveItem(x.id, { columnId: k.id,
      before: "no-such-id" })` rejects `before-missing` and
      `moveItem(a.id, { columnId: k.id, before: a.id })` rejects
      `before-self`, and the file text is unchanged;
      (e) `moveItem("no-such-id", { columnId: "nope", before: null })`
      resolves `null`, `update("no-such-id", { columnId: "nope" })` rejects
      `column`, and a following `list()` resolves.
      Run `node --test test/store.test.js` and observe (a) to (e) and the two
      tests from 1.2 fail.
- [x] 1.4 [req: store-reference-checks, store-mutations, store-item-order] In
      `src/store.js`, import `ItemReferenceError` from `./items.js`. Inside
      `createStore`, add `function checkColumn(columnId)` that, when
      `columnId` is neither `null` nor `undefined` and
      `!columns.some((c) => c.id === columnId)`, throws
      `new ItemReferenceError("column", columnId,
      "columnId names no column: " + columnId)`. Call `checkColumn(columnId)` as the first statement of
      the `create` operation. In `update`, add
      `if ("columnId" in patch) checkColumn(patch.columnId);` as the first
      statement of the operation, before the `findIndex`. In `moveItem`,
      after the `index === -1` return, call `checkColumn(columnId)`, then
      when `before != null`: `const target = items.find((i) => i.id ===
      before)`; throw `new ItemReferenceError("before-missing", before,
      "before names no item: " + before)` when absent;
      `new ItemReferenceError("before-self", before, "before must not be the
      moved item")` when `before === id`; and
      `new ItemReferenceError("before-lane", before, "before must be in the
      target column")` when `target.columnId !== columnId`. Leave the splice
      code as it is. Run `node --test test/store.test.js` and confirm it
      passes.

## 2. Items routes

- [x] 2.1 [req: items-move] In `test/items.test.js`, add a test "a column
      removed during a move is refused": make a temp store, a column `k`,
      and an unassigned item `x` through the store; build
      `const wrapped = { ...store, moveItem: (id, input) => {
      store.removeColumn(k.id); return store.moveItem(id, input); } }`; start
      `createApp({ store: wrapped })` on port 0 at "127.0.0.1" and push the
      server onto `servers`; send the move of `x` with
      `{"columnId":"<k.id>"}` through `send`; assert status `400`, error code
      `invalid-item`, and `(await store.get(x.id)).columnId === null`. Run
      `node --test test/items.test.js` and observe it fail with `200`.
- [x] 2.2 [req: items-move, store-reference-checks] In `src/routes/items.js`,
      delete the `requireColumn` function and its calls in the "POST /items"
      and "PATCH /items/:id" handlers, and in the move handler delete the
      `store.get(req.params.id)` pre-read, the `requireColumn` call, and the
      `if (input.before !== null)` block, leaving `validateItemMove`,
      `store.moveItem`, the `null`-is-404 line, and `res.json(item)`. Keep
      the `ItemValidationError` import and the error handler unchanged. Run
      `node --test test/items.test.js` and confirm it passes.

## 3. CLI move

- [x] 3.1 [req: cli-columns] In `test/cli.test.js`, import `main` from
      `../bin/banny.js` and add a test "move exits 4 when the column is
      removed during the move": make a temp store with column `c` and
      unassigned item `milk`; build a wrapper as in 2.1 that starts
      `store.removeColumn(c.id)` before `store.moveItem`; call
      `await main(["move", milk.id, c.id], { stdout, stderr, store: wrapped })`
      with `stdout` and `stderr` objects whose `write` pushes into arrays;
      assert it resolves `4`, the stderr text includes
      `"no column with id " + c.id`, and `(await store.get(milk.id)).columnId`
      is `null`. In the existing test "move with unknown ids exits 4", keep
      both assertions. Run `node --test test/cli.test.js` and observe the new
      test fail.
- [x] 3.2 [req: cli-columns] In `bin/banny.js`, import `ItemReferenceError`
      from `../src/items.js` and drop `validateItemMove` from that import. In
      `commands.move.run`, keep the arity checks and the `id`, `columnId`,
      and `before` assignments, delete the `store.get` and `store.getColumn`
      pre-checks and the `if (before !== null)` block, and call
      `store.moveItem(id, { columnId, before })` inside `try`; in `catch`,
      throw `new NotFoundError("no column with id " + columnId)` when
      `err instanceof ItemReferenceError && err.reason === "column"`, throw
      `new NotFoundError("no item with id " + before)` when its reason is
      `before-missing`, and otherwise rethrow `err`. Keep the
      `if (!item) throw new NotFoundError(...)` line and the return. Run
      `node --test test/cli.test.js` and confirm it passes.

## 4. Verify

- [x] 4.1 [req: *] Run `node --test` and confirm every test passes with a
      count of 142 plus the tests added here and zero failures. Confirm
      `grep -n "getColumn\|requireColumn" src/routes/items.js bin/banny.js`
      prints nothing.
