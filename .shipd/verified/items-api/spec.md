# items-api

### Requirement: Item validation module
id: item-validation

The system SHALL export from `src/items.js` the functions `validateNewItem(input)`
and `validateItemPatch(input)` and the class `ItemValidationError`, an `Error`
whose `code` is `invalid-item`. `validateNewItem` SHALL return
`{ title, done, tags, columnId }` with `title` trimmed, `done` defaulting to
`false`, `tags` defaulting to `[]`, and `columnId` defaulting to `null`.
`validateItemPatch` SHALL return an object holding only the `title`, `done`,
`tags`, and `columnId` keys present in `input`, with `title` trimmed. If
`input` is not a plain object, holds a key other than `title`, `done`, `tags`,
or `columnId`, has a trimmed `title` outside 1 to 200 characters or not a
string, has a non-boolean `done`, has `tags` that is not an array of at most 10
distinct strings matching `^[a-z0-9]+(-[a-z0-9]+)*$`, or has a `columnId` that
is neither `null` nor a non-empty string, then both functions SHALL throw
`ItemValidationError` with a message naming the field. If `validateNewItem`
receives no `title`, or `validateItemPatch` receives none of the four keys, then
it SHALL throw `ItemValidationError`.

#### Scenario: New item gets defaults and a trimmed title
- **WHEN** `validateNewItem({ title: "  milk  " })` is called
- **THEN** it returns `{ title: "milk", done: false, tags: [], columnId: null }`

#### Scenario: New item keeps a column id
- **WHEN** `validateNewItem({ title: "milk", columnId: "c1" })` is called
- **THEN** it returns `{ title: "milk", done: false, tags: [], columnId: "c1" }`

#### Scenario: Shape violations are rejected
- **WHEN** `validateNewItem` is called with each of `[]`, `{}`,
  `{ title: "   " }`, a 201-character title, `{ title: "a", done: "yes" }`,
  `{ title: "a", tags: ["Bad Tag"] }`, `{ title: "a", tags: ["x", "x"] }`,
  eleven distinct tags, `{ title: "a", id: "x" }`, and
  `{ title: "a", columnId: "" }`
- **THEN** each call throws an `ItemValidationError` whose `code` is
  `invalid-item`

#### Scenario: Patch keeps only provided keys
- **WHEN** `validateItemPatch({ done: true })` is called, then
  `validateItemPatch({ columnId: null })`, then `validateItemPatch({})`
- **THEN** the first returns `{ done: true }`, the second returns
  `{ columnId: null }`, and the third throws `ItemValidationError`

### Requirement: Items routes
id: items-routes

The system SHALL export from `src/routes/items.js` a default function
`(store) => Router` that `createApp` mounts directly after the health router,
serving these routes over the store from json-store's `createStore`:

- `GET /items` SHALL answer `200` with `{"items": [...]}` in store order;
  query parameters that filter the list are left to a later member.
- `POST /items` SHALL validate the body with `validateNewItem`, create the item,
  and answer `201` with the item as the body and a `Location: /items/<id>`
  header.
- `GET /items/:id` SHALL answer `200` with the item.
- `PATCH /items/:id` SHALL validate the body with `validateItemPatch`, update
  the item, and answer `200` with the updated item.
- `DELETE /items/:id` SHALL remove the item and answer `204` with no body.

If a `POST` or `PATCH` body carries a `columnId` that is not `null` and names no
column in the store, then the system SHALL answer `400` with code
`invalid-item` and SHALL NOT change the store. If `:id` names no item on `GET`,
`PATCH`, or `DELETE`, then the system SHALL answer `404` with
`{"error":{"code":"not-found","message":"<text>"}}`. If validation throws
`ItemValidationError`, then the system SHALL answer `400` with code
`invalid-item` and the error's message, and SHALL NOT change the store. Any
other error SHALL be passed to `next(err)`.

#### Scenario: Create, read, list
- **WHEN** a client sends `POST /items` with JSON `{"title":"milk","tags":["shop"]}`
  and then `GET /items/<id>` and `GET /items`
- **THEN** the create answers `201` with `Location: /items/<id>` and an item
  `{id, title: "milk", done: false, tags: ["shop"], columnId: null, createdAt, updatedAt}`,
  the read answers `200` with the same item, and the list answers `200` with
  `{"items": [<that item>]}`

#### Scenario: Create in a column
- **WHEN** the store holds column `c` and a client sends `POST /items` with JSON
  `{"title":"milk","columnId":"c"}`
- **THEN** the response is `201` and the created item's `columnId` is `c`

#### Scenario: Unknown column is refused
- **WHEN** a client sends `POST /items` with JSON
  `{"title":"milk","columnId":"nope"}`
- **THEN** the response is `400` with code `invalid-item` and `GET /items`
  still answers `{"items": []}`

#### Scenario: Update and delete
- **WHEN** a client sends `PATCH /items/<id>` with `{"done":true}` and then
  `DELETE /items/<id>` and `GET /items/<id>`
- **THEN** the patch answers `200` with `done: true` and the original title, the
  delete answers `204` with an empty body, and the read answers `404` with code
  `not-found`

#### Scenario: Invalid item is refused
- **WHEN** a client sends `POST /items` with JSON `{"title":""}`
- **THEN** the response is `400` with code `invalid-item` and `GET /items`
  still answers `{"items": []}`

#### Scenario: Unknown id
- **WHEN** a client sends `GET`, `PATCH` with `{"done":true}`, and `DELETE` to
  `/items/no-such-id`
- **THEN** each answers `404` with code `not-found`

### Requirement: JSON-only request bodies
id: json-bodies

The items router SHALL own JSON body parsing with `express.json()` on its
`POST` and `PATCH` routes. If the request's `Content-Type` is not
`application/json` (parameters such as `charset` allowed), or the request has
no body, then the system SHALL answer `415` with
`{"error":{"code":"unsupported-media-type","message":"<text>"}}` before
parsing. If the body does not parse as JSON, or the body parser rejects it
with any other client error (such as a body over its size limit), then the
system SHALL answer `400` with code `invalid-json`, never `500 internal`.

#### Scenario: Malformed JSON body
- **WHEN** a client sends `POST /items` with `Content-Type: application/json`
  and the body `{bad`
- **THEN** the response is `400` with code `invalid-json`

#### Scenario: Oversized JSON body
- **WHEN** a client sends `POST /items` with `Content-Type: application/json`
  and a valid JSON body larger than 100 kB
- **THEN** the response is `400` with code `invalid-json`, not `500`

#### Scenario: Non-JSON body
- **WHEN** a client sends `POST /items` with `Content-Type: text/plain` and the
  body `{"title":"milk"}`, and `PATCH /items/<id>` with the same header
- **THEN** both answer `415` with code `unsupported-media-type` and the store is
  unchanged

### Requirement: Server builds the store
id: server-store

When `src/server.js` runs as the entry point, the system SHALL call
`createStore()`, whose path comes from `BANNY_DATA` (default
`data/banny.json`), and SHALL pass that store to `startServer({ store })`, so
`npm start` serves the items API over the data file.

#### Scenario: npm start serves items from BANNY_DATA
- **WHEN** a user runs `npm start` with `BANNY_DATA` naming a temp file and
  `PORT` set to a free port, then sends `POST /items` with `{"title":"milk"}`
- **THEN** the response is `201` and the temp file holds that item

### Requirement: Move an item to a position
id: items-move

The system SHALL export from `src/items.js` a function `validateItemMove(input)`
returning `{ columnId, before }`, where `columnId` is required and is `null` or
a non-empty string, and `before` is optional, `null` or a non-empty string, and
defaults to `null`. If `input` is not a plain object, holds a key other than
`columnId` or `before`, lacks `columnId`, or has either field of the wrong type,
then it SHALL throw `ItemValidationError`.

The items router SHALL serve "POST /items/:id/move", with the same JSON body
handling as its other writing routes. It SHALL validate the body with
`validateItemMove`, move the item with the store's `moveItem`, and answer `200`
with the moved item. "GET /items" SHALL keep answering in store order, which is
the card order. The router SHALL leave the column and `before` checks to
`moveItem`, and its "POST /items" and "PATCH /items/:id" routes SHALL leave the
column check to `create` and `update`, so every check holds against the state
the write changes. If `columnId` is not `null` and names no column, or `before`
is not `null` and names no item, names the moved item itself, or names an item
whose `columnId` differs from `columnId`, then the system SHALL answer `400`
with code `invalid-item` and the store's message, and SHALL NOT change the
store. If `:id` names no item, then the system SHALL answer `404` with code
`not-found`, ahead of any column or `before` check.

#### Scenario: Validation defaults and refusals
- **WHEN** `validateItemMove({ columnId: "c" })` is called, then each of `{}`,
  `{ columnId: "" }`, `{ columnId: null, before: 1 }`, and
  `{ columnId: null, title: "x" }`
- **THEN** the first returns `{ columnId: "c", before: null }` and each of the
  others throws an `ItemValidationError` whose `code` is `invalid-item`

#### Scenario: Drop a card before another
- **WHEN** column `k` holds `a` then `b`, `x` is unassigned, and a client sends
  a move of `x` with `{"columnId":"<k>","before":"<b>"}`
- **THEN** the response is `200` with `x` carrying `columnId` `<k>`, and
  "GET /items" lists `a`, `x`, `b` in that order

#### Scenario: Bad position is refused
- **WHEN** a client sends a move of `a` with `before` naming `a` itself, then
  with `before` naming an item in another column, then with
  `{"columnId":"nope"}`
- **THEN** each answers `400` with code `invalid-item` and "GET /items" is
  unchanged

#### Scenario: Unknown item
- **WHEN** a client sends a move of "no-such-id" with `{"columnId":null}`,
  then with `{"columnId":"nope"}`
- **THEN** each response is `404` with code `not-found`

#### Scenario: A column removed during the move is refused
- **WHEN** the app runs over a store wrapper whose `moveItem` first starts
  `removeColumn(k)` and then calls the real `moveItem`, and a client sends a
  move of unassigned `x` with `{"columnId":"<k>"}`
- **THEN** the response is `400` with code `invalid-item`, and `x` still has
  `columnId` `null`
