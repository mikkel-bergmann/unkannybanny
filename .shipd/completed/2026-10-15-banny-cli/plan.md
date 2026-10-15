# banny-cli
Status: verified
Epic: unkannybanny

## Idea

Add `bin/banny.js`, a `banny` command with `list`, `add`, `done`, and `remove`
verbs that work on the JSON store directly, with fixed exit codes and a
`--json` flag.

### Motivation

Someone at a terminal, or a script, cannot read or change the board without
starting the server and sending HTTP requests. seed-and-export also needs a CLI
to add its `seed` and `export` verbs to.

### Details

- `bin/banny.js`: an exported `commands` table, `main(argv, io)`, and an entry
  guard that works through npm's bin symlink.
- `package.json`: `"bin": {"banny": "bin/banny.js"}`.
- `test/cli.test.js`: spawns the CLI against a temp `BANNY_DATA` file.

Affected capabilities: `banny-cli` (added). Uses json-store's
`createStore({ path })` and items-api's `validateNewItem`, `validateItemPatch`,
and `ItemValidationError`. No new dependency (`node:util` `parseArgs`).

### Non-goals

- No tag filters or search on `list` (tags-and-search); no `seed` or `export`
  (seed-and-export).
- No HTTP calls, no `--data` flag (use `BANNY_DATA`), no title edit verb, no
  id prefixes, no README change.

## Implementation

- **Dispatch shape.** `export const commands = { list, add, done, remove }`.
  Each entry is `{ usage, options, run }`: `usage` is a one-line synopsis,
  `options` is a `parseArgs` options object, and
  `run({ args, values, store })` resolves to `{ json, text }`. seed-and-export
  adds a verb by adding one entry. `--help` builds its text from the table, so
  new verbs show up in help without other edits. Rejected: a `switch` in
  `main`, which a new verb would have to edit.
- **Parsing.** The verb is the first argument that does not start with `-`.
  `parseArgs({ args: argv, options: { json, help, ...cmd.options },
  allowPositionals: true, strict: true })`, and `positionals[0]` must equal
  the verb. Any `ERR_PARSE_ARGS_*` error becomes a usage error. The `--json`
  mode is decided by `argv.includes("--json")` before parsing, so usage errors
  are also printed as JSON.
- **Errors and exit codes (Q1).** `UsageError` (code `usage`, exit 2),
  `ItemValidationError` (`invalid-item`, 3), `NotFoundError` (`not-found`, 4),
  store `store-corrupt` (1), anything else `internal` (1). In human mode the
  error goes to stderr as `banny: <message>`; under `--json` it goes to stderr
  as `{"error":{"code","message"}}`. stdout stays empty on any failure.
- **Verbs (Q2, Q3, Q4).** `add` joins the remaining words into the title and
  collects repeatable `--tag` values, then calls `validateNewItem` and
  `store.create`. `done <id>` sends `validateItemPatch({ done: !values.undo })`
  to `store.update`. `remove <id>` calls `store.remove`. Ids must match
  exactly; a `null` or `false` result from the store becomes `NotFoundError`.
- **Output (Q5).** Item line:
  `` `${id}  [${done ? "x" : " "}] ${title}` `` and, when the item has tags,
  `"  " + tags.map(t => "#" + t).join(" ")`. Under `--json` the output is
  `JSON.stringify(json) + "\n"`. Non-empty `text` is followed by `"\n"`, so an
  empty list prints nothing.
- **Entry guard.** `import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href`,
  then `process.exitCode = await main(process.argv.slice(2))`. It uses
  `exitCode` rather than `process.exit()` so stdout drains. The plain guard
  that app-scaffold uses fails through `node_modules/.bin/banny`, which is a
  symlink (see the probe below).
- **Store.** `main` uses `io.store` when given, else `createStore()`. The store
  reloads on mtime or size change, so the CLI and a running server can share
  the file.
- **Tests.** `test/cli.test.js` runs `spawnSync(process.execPath, [BIN, ...args])`
  with `BANNY_DATA` set to a `mkdtemp` file. It sets up items through
  `createStore` and asserts status, stdout, stderr, and the file.

Risk: a verb that runs while the server writes can race the reload check
within mtime resolution. The epic accepts this.

## Questions and answers

### Q1: What exit codes does the CLI use?
- **Question:** Options: (1) 0 ok, 1 store or unexpected failure, 2 usage,
  3 invalid item, 4 unknown id; (2) 0, 1 any runtime failure, 2 usage;
  (3) 0 or 1. Recommendation: (1).
- **Verdict:** INSUFFICIENT
- **Answered by:** USER
- **Answer:** Option 1, so a script can tell a missing id from a bad title
  from a broken store.
- **Queued:** q-banny-cli-exit-codes
- **Relied on by:** seed-and-export

### Q2: What does `banny done <id>` do?
- **Question:** Options: (1) set `done: true` idempotently, `--undo` sets
  `false`; (2) set `true` only; (3) toggle. Recommendation: (1).
- **Verdict:** INSUFFICIENT
- **Answered by:** USER
- **Answer:** Option 1: repeating it is safe in scripts, and an item can be
  reopened without a fifth verb.
- **Queued:** q-banny-cli-done-verb-semantics

### Q3: How do `done` and `remove` match an id?
- **Question:** Options: (1) exact full id only; (2) exact id or a unique
  prefix of 4 or more characters; (3) a 1-based list index.
  Recommendation: (1).
- **Verdict:** INSUFFICIENT
- **Answered by:** USER
- **Answer:** Option 1: the same id contract as the store and the API, and
  `list` prints the full id.
- **Queued:** q-banny-cli-id-matching

### Q4: What is the syntax of `banny add`?
- **Question:** Options: (1) `add <title words...> [--tag <tag>]...`, words
  joined with one space; (2) exactly one quoted title; (3) `--title` only.
  Recommendation: (1).
- **Verdict:** INSUFFICIENT
- **Answered by:** USER
- **Answer:** Option 1: `banny add buy milk --tag shop` works without quotes.
- **Queued:** q-banny-add-syntax

### Q5: What does the CLI print?
- **Question:** Options: (1) human item lines `<id>  [x] <title>  #tags`, and
  `--json` mirroring the API (`{"items":[...]}`, the item,
  `{"id","removed":true}`, errors as `{"error":{"code","message"}}` on
  stderr); (2) the same with a bare-array list; (3) tab-separated output and
  no JSON errors. Recommendation: (1).
- **Verdict:** INSUFFICIENT
- **Answered by:** USER
- **Answer:** Option 1: the JSON output uses the epic's API list and error
  shapes.
- **Queued:** q-banny-cli-output-format
- **Relied on by:** seed-and-export

## Readiness attestation

### Problem and motivation

There is no way to work on the board from a terminal without the server, and
seed-and-export needs a CLI to extend.

Evidence:

- Epic `unkannybanny` Changes rows banny-cli and seed-and-export (After:
  banny-cli); Design: "The CLI reuses the store and the validator directly".

### Scope and non-goals

Four verbs, exit codes, `--json`, and the `bin` entry. Filters, search, seed,
and export are left to other members.

Evidence:

- Epic Changes rows tags-and-search and seed-and-export; Decision "Layout is
  fixed" (`bin/banny.js`).

### Affected capabilities and files

One new capability and three files, built on two unmerged interfaces.

Evidence:

- Capability `banny-cli` (added); the library is empty.
- Files: `bin/banny.js` (new), `test/cli.test.js` (new), `package.json:1-13`.
- Interfaces: json-store `createStore({ path })`, unknown id gives
  `null`/`false`, `store-corrupt` code (json-store Q1, Q2); items-api
  validators (items-api Q3).
- Runnable premise: a Node probe of `parseArgs` with `allowPositionals` and
  `strict` returned `tag: ["a","b"]` for repeated `--tag` with flags after
  positionals, and threw `ERR_PARSE_ARGS_UNKNOWN_OPTION` and
  `ERR_PARSE_ARGS_INVALID_OPTION_VALUE`.
- Runnable premise: run through a `node_modules/.bin` symlink, the plain guard
  compared false and the realpath guard compared true.
- Runnable premise: `npm test` in the worktree exited 0.

### No open task-shaping decision

Every decision is settled.

Evidence:

- Exit codes Q1, done semantics Q2, id matching Q3, add syntax Q4, output Q5:
  planner defaults (the oracle queued each one).
- Dispatch table, parsing, entry guard, and test style: settled by
  investigation and the probes.
- Personal memory store: none exists.
