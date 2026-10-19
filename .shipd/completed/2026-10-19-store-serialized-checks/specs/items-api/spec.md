## MODIFIED Requirements

### Requirement: Move an item to a position
id: items-move
base: d28c9e368bdc

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
