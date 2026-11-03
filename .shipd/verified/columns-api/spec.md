# columns-api

### Requirement: Column validation module
id: column-validation

The system SHALL export from `src/columns.js` the functions
`validateNewColumn(input)` and `validateColumnPatch(input)` and the class
`ColumnValidationError`, an `Error` whose `code` is `invalid-column`.
`validateNewColumn` SHALL return `{ name }` with `name` trimmed.
`validateColumnPatch` SHALL return an object holding only the `name` key when
`input` has it. If `input` is not a plain object, holds a key other than `name`,
or has a `name` that is not a string or whose trimmed form is outside 1 to 100
characters, then both functions SHALL throw `ColumnValidationError` with a
message naming the field. If `validateNewColumn` receives no `name`, or
`validateColumnPatch` receives no `name`, then it SHALL throw
`ColumnValidationError`.

#### Scenario: New column trims its name
- **WHEN** `validateNewColumn({ name: "  Doing  " })` is called
- **THEN** it returns `{ name: "Doing" }`

#### Scenario: Shape violations are rejected
- **WHEN** `validateNewColumn` is called with each of `[]`, `{}`,
  `{ name: "   " }`, a 101-character name, `{ name: 1 }`, and
  `{ name: "a", id: "x" }`, and `validateColumnPatch({})` is called
- **THEN** each call throws a `ColumnValidationError` whose `code` is
  `invalid-column`

#### Scenario: Patch keeps only the provided name
- **WHEN** `validateColumnPatch({ name: "In progress" })` is called, then
  `validateColumnPatch({})`
- **THEN** the first returns `{ name: "In progress" }` and the second throws
  `ColumnValidationError`

### Requirement: Columns routes
id: columns-routes

The system SHALL export from `src/routes/columns.js` a default function
`(store) => Router` that `createApp` mounts directly after the tags router,
serving these routes over the store from json-store's `createStore`:

- `GET /columns` SHALL answer `200` with `{"columns": [...]}` in store order.
- `POST /columns` SHALL validate the body with `validateNewColumn`, create the
  column, and answer `201` with the column as the body and a
  `Location: /columns/<id>` header.
- `PATCH /columns/:id` SHALL validate the body with `validateColumnPatch`,
  update the column, and answer `200` with the updated column.
- `DELETE /columns/:id` SHALL remove the column, unassigning its items, and
  answer `204` with no body.
- `PUT /columns/order` SHALL read `{"ids": [...]}` and answer `200` with
  `{"columns": [...]}` holding every column in the order the ids name.

If `:id` names no column on `PATCH` or `DELETE`, then the system SHALL answer
`404` with `{"error":{"code":"not-found","message":"<text>"}}`. If validation
throws `ColumnValidationError`, or `PUT /columns/order` receives a body whose
`ids` is not an array of strings that is a permutation of the current column
ids, then the system SHALL answer `400` with code `invalid-column` and SHALL NOT
change the store. The router SHALL own JSON body parsing with `express.json()`
on its writing routes, SHALL answer `415` with code `unsupported-media-type`
when the request body is not `application/json`, and SHALL answer `400` with
code `invalid-json` when the body does not parse. Any other error SHALL be
passed to `next(err)`.

#### Scenario: Create, read, list
- **WHEN** a client sends `POST /columns` with JSON `{"name":"Doing"}` and then
  `GET /columns`
- **THEN** the create answers `201` with `Location: /columns/<id>` and a column
  `{id, name: "Doing", createdAt, updatedAt}`, and the list answers `200` with
  `{"columns": [<that column>]}`

#### Scenario: Rename and remove
- **WHEN** a client sends `PATCH /columns/<id>` with `{"name":"In progress"}`,
  then `DELETE /columns/<id>`, then `GET /columns`
- **THEN** the patch answers `200` with `name: "In progress"`, the delete
  answers `204` with an empty body, and the list answers `200` with
  `{"columns": []}`

#### Scenario: Reorder
- **WHEN** the store holds columns `a`, `b`, `c` and a client sends
  `PUT /columns/order` with `{"ids":["c","a","b"]}`
- **THEN** the response is `200` with `{"columns":[<c>,<a>,<b>]}` and
  `GET /columns` lists them in that order

#### Scenario: Bad reorder is refused
- **WHEN** three columns exist and a client sends `PUT /columns/order` with
  `{"ids":["a"]}`, then with `{"ids":["a","a","b"]}`
- **THEN** each answers `400` with code `invalid-column` and `GET /columns`
  still lists the original order

#### Scenario: Unknown id
- **WHEN** a client sends `PATCH` with `{"name":"x"}` and `DELETE` to
  `/columns/no-such-id`
- **THEN** each answers `404` with code `not-found`

#### Scenario: Non-JSON body is refused
- **WHEN** a client sends `POST /columns` with `Content-Type: text/plain`
- **THEN** the response is `415` with code `unsupported-media-type`
