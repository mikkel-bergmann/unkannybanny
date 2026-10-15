## 1. Tests first

- [x] 1.1 [req: cli-dispatch, cli-exit-codes] Create `test/cli.test.js` using
      `node:test` and `node:assert/strict`. Define
      `BIN = fileURLToPath(new URL("../bin/banny.js", import.meta.url))` and a
      helper `banny(dataFile, ...args)` returning
      `spawnSync(process.execPath, [BIN, ...args], { env: { ...process.env, BANNY_DATA: dataFile }, encoding: "utf8" })`.
      Each test makes its own `fs.mkdtemp(path.join(os.tmpdir(), "banny-cli-"))`
      directory and uses `<dir>/banny.json`; seed items with
      `createStore({ path })` from `../src/store.js`. Add tests: `--help` exits
      `0` and stdout contains `list`, `add`, `done`, `remove`; no arguments,
      `frobnicate`, `list --nope`, `add --tag`, and `list extra` each exit `2`
      with empty stdout and non-empty stderr; `await import("../bin/banny.js")`
      exposes `commands` whose `Object.keys(commands).slice(0, 4)`
      deep-equals `["list", "add", "done", "remove"]` (later verbs may
      follow) and runs no verb; with one seeded
      item, `fs.symlink(BIN, <dir>/banny)` and running
      `spawnSync(process.execPath, [<dir>/banny, "list"], ...)` exits `0` and
      stdout contains the item's id.
- [x] 1.2 [req: cli-list, cli-add, cli-done, cli-remove] In `test/cli.test.js`,
      add: seed an open `milk` tagged `["shop"]` and a done `bread`, then
      `list` stdout equals `${id1}  [ ] milk  #shop\n${id2}  [x] bread\n`;
      `list` on a missing file prints `""`, exits `0`, and the file still does
      not exist; `add buy milk --tag shop --tag home` exits `0`, stdout equals
      `${id}  [ ] buy milk  #shop #home\n`, and the parsed file holds that item
      with `done: false`; `add milk --tag "Bad Tag"` and `add` with
      `"a".repeat(201)` exit `3` and leave the file bytes unchanged;
      `add --tag shop` exits `2`; `done <id>` run twice prints
      `${id}  [x] <title>\n` and exits `0` each time, then `done <id> --undo`
      prints `${id}  [ ] <title>\n` and the file holds `done: false`;
      `done no-such-id` and `done <first 8 chars of id>` exit `4`; `remove <id>`
      exits `0` with stdout `removed <id>\n` and the item is gone, and a second
      `remove <id>` exits `4`; `done` and `remove` with zero or two ids exit `2`.
- [x] 1.3 [req: cli-json, cli-exit-codes] In `test/cli.test.js`, add:
      `add milk --json` stdout parses to an item with `title` `"milk"`;
      `list --json` parses to `{ items: [<that item>] }`;
      `--json done <id>` parses to the item with `done: true`;
      `remove <id> --json` parses to `{ id, removed: true }`;
      `done no-such-id --json` exits `4`, stdout `""`, and stderr parses with
      `error.code === "not-found"` and a string `error.message`;
      `frobnicate --json` exits `2` with `error.code === "usage"`;
      `remove no-such-id` exits `4`, stdout `""`, and stderr is one line
      starting `banny: `; a file holding `not json` makes `list --json` exit
      `1` with `error.code === "store-corrupt"` and the file still reads
      `not json`.
- [x] 1.4 [req: *] Run `npm test` and observe the new tests fail because
      `bin/banny.js` does not exist.

## 2. CLI

- [x] 2.1 [req: cli-dispatch, cli-exit-codes] Create `bin/banny.js` with first
      line `#!/usr/bin/env node`. Import `parseArgs` from `node:util`,
      `realpathSync` from `node:fs`, `pathToFileURL` from `node:url`,
      `createStore` from `../src/store.js`, and `validateNewItem`,
      `validateItemPatch`, `ItemValidationError` from `../src/items.js`.
      Define `class UsageError extends Error` (`code = "usage"`) and
      `class NotFoundError extends Error` (`code = "not-found"`), and
      `EXIT = { usage: 2, "invalid-item": 3, "not-found": 4, "store-corrupt": 1, internal: 1 }`.
      Define `GLOBAL_OPTIONS = { json: { type: "boolean" }, help: { type: "boolean", short: "h" } }`
      and `formatItem(item)` returning
      `` `${item.id}  [${item.done ? "x" : " "}] ${item.title}` `` plus
      `"  " + item.tags.map((t) => "#" + t).join(" ")` when `item.tags.length > 0`.
- [x] 2.2 [req: cli-list, cli-add, cli-done, cli-remove] In `bin/banny.js`,
      export `commands`, keyed in the order `list`, `add`, `done`, `remove`,
      each `{ usage, options, run }` with `run({ args, values, store })`
      resolving to `{ json, text }`. `list`: usage `banny list`, no options,
      throws `UsageError` if `args.length > 0`, returns
      `{ json: { items }, text: items.map(formatItem).join("\n") }`. `add`:
      usage `banny add <title words...> [--tag <tag>]...`, options
      `{ tag: { type: "string", multiple: true } }`, throws `UsageError` when
      `args` is empty, creates
      `store.create(validateNewItem({ title: args.join(" "), tags: values.tag ?? [] }))`,
      returns `{ json: item, text: formatItem(item) }`. `done`: usage
      `banny done <id> [--undo]`, options `{ undo: { type: "boolean" } }`,
      throws `UsageError` unless `args.length === 1`, calls
      `store.update(args[0], validateItemPatch({ done: !values.undo }))`,
      throws `NotFoundError("no item with id <id>")` on `null`, returns the
      item and its line. `remove`: usage `banny remove <id>`, no options,
      throws `UsageError` unless `args.length === 1`, throws `NotFoundError`
      when `store.remove` resolves `false`, returns
      `{ json: { id, removed: true }, text: "removed " + id }`.
- [x] 2.3 [req: cli-dispatch, cli-json, cli-exit-codes] In `bin/banny.js`,
      export `async function main(argv, { stdout = process.stdout, stderr = process.stderr, store } = {})`.
      Set `asJson = argv.includes("--json")`. Inside `try`: if `argv`
      includes `--help` or `-h`, write `usage:` and each `commands[v].usage`
      on its own line to stdout and return `0`; take `verb` as the first
      element not starting with `-`; throw `UsageError` when it is missing or
      not an own key of `commands`; call `parseArgs({ args: argv, options: { ...GLOBAL_OPTIONS, ...commands[verb].options }, allowPositionals: true, strict: true })`,
      rethrowing any error whose `code` starts with `ERR_PARSE_ARGS` as
      `UsageError(err.message)`; throw `UsageError` unless
      `positionals[0] === verb`; run the verb with
      `args: positionals.slice(1)`, `values`, and `store ?? createStore()`;
      write `JSON.stringify(json) + "\n"` when `asJson`, else `text + "\n"`
      when `text` is non-empty; return `0`. In `catch`: `code` is
      `"invalid-item"` for `ItemValidationError`, `err.code` when it is
      `usage`, `not-found`, or `store-corrupt`, else `"internal"`; write
      `JSON.stringify({ error: { code, message: err.message } }) + "\n"` to
      stderr when `asJson`, else `banny: ${err.message}\n`; return `EXIT[code]`.
- [x] 2.4 [req: cli-dispatch] At the bottom of `bin/banny.js`, when
      `process.argv[1]` is set and
      `import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href`,
      set `process.exitCode = await main(process.argv.slice(2))`. Never call
      `process.exit`. Run `chmod +x bin/banny.js` so git records mode `100755`.
- [x] 2.5 [req: cli-dispatch] In `package.json`, add a top-level
      `"bin": { "banny": "bin/banny.js" }` after `"description"`. Change no
      other key.

## 3. Verify

- [x] 3.1 [req: *] Run `npm test` and confirm every test passes, including the
      existing store, items, and app tests. Then run
      `BANNY_DATA=<tmp>/banny.json node bin/banny.js add buy milk --tag shop`
      and `node bin/banny.js list --json` with the same variable, and confirm
      the item and exit code `0`. Confirm `git ls-files -s bin/banny.js`
      shows mode `100755`.
