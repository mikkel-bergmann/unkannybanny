## MODIFIED Requirements

### Requirement: Export document
id: export-document
base: 083774de88a1

The system SHALL export from `src/routes/export.js` a named function
`serializeExport(items, columns = [])` returning
`JSON.stringify({ items, columns }, null, 2) + "\n"` when `columns` is non-empty
and `JSON.stringify({ items }, null, 2) + "\n"` when it is empty — the same text
json-store writes to the data file. Both `banny export` and `GET /export` SHALL
produce their document through it, so the two outputs are byte-identical for the
same store and either can be used as a `BANNY_DATA` file.

#### Scenario: Export output loads as a data file
- **WHEN** a store holds two items and one column, `banny export` is written to
  a new file, and `createStore({ path: <that file> }).list()` and
  `.listColumns()` are called
- **THEN** they resolve to the same two items and the same one column

### Requirement: Export verb
id: export-verb
base: ba92a2c48f41

When a user runs `banny export`, the system SHALL read every item and every
column from the store and write `serializeExport(items, columns)` to stdout and
nothing else. Where `--json` is given, the system SHALL print the same object as
one compact JSON line, per the CLI's JSON convention. The system SHALL NOT
change or create the data file.

#### Scenario: Export prints the whole store
- **WHEN** the store holds an open item `milk` tagged `shop`, a done item
  `bread`, and one column, and a user runs `banny export`
- **THEN** the exit code is `0`, stdout equals `serializeExport(items, columns)`
  for that store, and stdout is byte-identical to the data file after the
  store's last write

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
base: 3183f6d91ccd

The system SHALL default-export from `src/routes/export.js` a function
`(store) => Router` that `createApp` mounts after the columns router (or after
the tags router where the columns router is not mounted) and before any static,
`no-route`, or error handler. When a client sends `GET /export`, the system
SHALL answer `200` with `Content-Type: application/json; charset=utf-8`,
`Content-Disposition: attachment; filename="banny-export.json"`, and the body
`serializeExport(items, columns)` over every item and column in store order. If
the store rejects, then the router SHALL pass the error to `next(err)`, so the
app's error handler answers it.

#### Scenario: Export downloads the store
- **WHEN** the store holds two items and one column and a client sends
  `GET /export`
- **THEN** the response is `200`, `Content-Type` starts with
  `application/json`, `Content-Disposition` equals
  `attachment; filename="banny-export.json"`, and the body text equals
  `serializeExport` of the store's items and columns

#### Scenario: Route and CLI agree
- **WHEN** the same data file is exported by `GET /export` and by
  `banny export`
- **THEN** the two outputs are byte-identical

#### Scenario: Corrupt store fails the route
- **WHEN** the data file holds `not json` and a client sends `GET /export`
- **THEN** the response status is `500` and the file still holds `not json`
