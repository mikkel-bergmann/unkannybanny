## ADDED Requirements

### Requirement: Seed and export verbs join the CLI verb table
id: seed-export-commands

The system SHALL add `seed` and `export` entries to the `commands` table that
`bin/banny.js` exports, so `commands` holds, in order, `list`, `add`, `done`,
`remove`, `seed`, and `export`. Each new entry SHALL have the same shape as
the existing ones: `{ usage, options, run }`, with
`run({ args, values, store })` resolving to `{ json, text }`, dispatched by the
existing `main(argv, { stdout, stderr, store })` with its existing error codes
and exit codes. Neither verb SHALL take a positional argument; if one is given,
then the system SHALL treat it as a usage error and exit `2`.

#### Scenario: Help lists the new verbs
- **WHEN** a user runs `node bin/banny.js --help`
- **THEN** stdout names `seed` and `export` alongside `list`, `add`, `done`,
  and `remove`, and the exit code is `0`

#### Scenario: Verb table holds six verbs
- **WHEN** a test imports `bin/banny.js`
- **THEN** `Object.keys(commands)` equals
  `["list", "add", "done", "remove", "seed", "export"]` and no verb runs

#### Scenario: Extra arguments are a usage error
- **WHEN** a user runs `banny seed extra`, then `banny export extra`
- **THEN** each run exits `2`, writes nothing to stdout, and leaves the store
  unchanged

### Requirement: Seed verb
id: seed-verb

When a user runs `banny seed` and the store holds no items, the system SHALL
pass each of the five entries of the `SAMPLE_ITEMS` constant in
`bin/banny.js` through items-api's `validateNewItem` before creating any, then
create them in order with the store's `create`, and print one list line per
created item; under `--json` it SHALL print `{"items":[...]}` holding the
created items. The sample items SHALL be, in order: `Peel the bananas` tagged
`kitchen`; `Buy more bananas` tagged `shop` and `kitchen`; `Water the banana
plant` tagged `garden`; `Write the board README`, done, tagged `docs`; and
`Plan the banana bread bake-off` with no tags. If the store already holds one
or more items, then the system SHALL create nothing, exit `0`, print
`store is not empty; nothing seeded`, and under `--json` print
`{"items":[]}`.

#### Scenario: Seed an empty store
- **WHEN** `BANNY_DATA` names a file that does not exist and a user runs
  `banny seed`
- **THEN** the exit code is `0`, stdout holds five list lines in the order
  above with the fourth marked `[x]`, and the data file holds those five items
  with ids and timestamps

#### Scenario: Seed is safe to rerun
- **WHEN** a user runs `banny seed` twice on the same data file
- **THEN** the second run exits `0`, stdout is
  `store is not empty; nothing seeded`, and the file still holds five items

#### Scenario: Seed under --json
- **WHEN** a user runs `banny seed --json` on an empty store, then again
- **THEN** the first stdout parses as `{"items":[...]}` with five items whose
  titles match the sample list, and the second parses as `{"items":[]}`

#### Scenario: Seed on a corrupt store
- **WHEN** the data file holds `not json` and a user runs `banny seed --json`
- **THEN** the exit code is `1`, stderr parses with `error.code`
  `store-corrupt`, and the file still holds `not json`

### Requirement: Export document
id: export-document

The system SHALL export from `src/routes/export.js` a named function
`serializeExport(items)` returning `JSON.stringify({ items }, null, 2) + "\n"`,
the same text json-store writes to the data file. Both `banny export` and
`GET /export` SHALL produce their document through it, so the two outputs are
byte-identical for the same store and either can be used as a `BANNY_DATA`
file.

#### Scenario: Export output loads as a data file
- **WHEN** a store holds two items, `banny export` is written to a new file,
  and `createStore({ path: <that file> }).list()` is called
- **THEN** it resolves to the same two items

### Requirement: Export verb
id: export-verb

When a user runs `banny export`, the system SHALL read every item from the
store and write `serializeExport(items)` to stdout and nothing else. Where
`--json` is given, the system SHALL print the same `{"items":[...]}` object as
one compact JSON line, per the CLI's JSON convention. The system SHALL NOT
change or create the data file.

#### Scenario: Export prints the whole store
- **WHEN** the store holds an open item `milk` tagged `shop` and a done item
  `bread`, and a user runs `banny export`
- **THEN** the exit code is `0`, stdout equals `serializeExport(items)` for
  those two items in store order, and stdout is byte-identical to the data
  file after the store's last write

#### Scenario: Export of an empty store
- **WHEN** `BANNY_DATA` names a file that does not exist and a user runs
  `banny export`
- **THEN** stdout is `{\n  "items": []\n}\n`, the exit code is `0`, and the
  file still does not exist

#### Scenario: Export on a corrupt store
- **WHEN** the data file holds `not json` and a user runs `banny export`
- **THEN** the exit code is `1`, stdout is empty, and stderr is one line
  starting `banny: `

### Requirement: Export route
id: export-route

The system SHALL default-export from `src/routes/export.js` a function
`(store) => Router` that `createApp` mounts after the tags router (or after the
items router where the tags router is not mounted) and before any static,
`no-route`, or error handler. When a client sends `GET /export`, the system
SHALL answer `200` with `Content-Type: application/json; charset=utf-8`,
`Content-Disposition: attachment; filename="banny-export.json"`, and the body
`serializeExport(items)` over every item in store order. If the store rejects,
then the router SHALL pass the error to `next(err)`, so the app's error handler
answers it.

#### Scenario: Export downloads the store
- **WHEN** the store holds two items and a client sends `GET /export`
- **THEN** the response is `200`, `Content-Type` starts with
  `application/json`, `Content-Disposition` equals
  `attachment; filename="banny-export.json"`, and the body text equals
  `serializeExport` of the two items

#### Scenario: Route and CLI agree
- **WHEN** the same data file is exported by `GET /export` and by
  `banny export`
- **THEN** the two outputs are byte-identical

#### Scenario: Corrupt store fails the route
- **WHEN** the data file holds `not json` and a client sends `GET /export`
- **THEN** the response status is `500` and the file still holds `not json`
