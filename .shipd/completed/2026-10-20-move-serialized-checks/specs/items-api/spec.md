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
with the moved item. The route SHALL NOT read the store before `moveItem`: the
column and `before` checks run inside the store's serialized write. "GET /items"
SHALL keep answering in store order, which is the card order. If `columnId` is
not `null` and names no column, or `before` is not `null` and names no item,
names the moved item itself, or names an item whose `columnId` differs from
`columnId`, then the system SHALL answer `400` with code `invalid-item` and the
store's message, and SHALL NOT change the store; these checks take precedence
over an unknown `:id`. If `:id` names no item, then the system SHALL answer
`404` with code `not-found`.

#### Scenario: Validation defaults and refusals
- **WHEN** `validateItemMove({ columnId: "c" })` is called, then each of `{}`,
  `{ columnId: "" }`, `{ columnId: null, before: 1 }`, and
  `{ columnId: null, title: "x" }`
- **THEN** the first returns `{ columnId: "c", before: null }` and each of the
  others throws an `ItemValidationError` whose `code` is `invalid-item`

#### Scenario: Drop a card before another
- **WHEN** column `k` holds `a` then `b`, `x` is unassigned, and a client sends
  "POST /items/<x>/move" with `{"columnId":"<k>","before":"<b>"}`
- **THEN** the response is `200` with `x` carrying `columnId` `<k>`, and
  "GET /items" lists `a`, `x`, `b` in that order

#### Scenario: Bad position is refused
- **WHEN** a client sends "POST /items/<a>/move" with `before` naming `a`
  itself, then with `before` naming an item in another column, then with
  `{"columnId":"nope"}`
- **THEN** each answers `400` with code `invalid-item` and "GET /items" is
  unchanged

#### Scenario: Unknown item
- **WHEN** a client sends "POST /items/no-such-id/move" with
  `{"columnId":null}`
- **THEN** the response is `404` with code `not-found`

#### Scenario: A before item deleted during the move is refused
- **WHEN** the app's store is wrapped so `moveItem` first starts
  `remove(<a>)`, and a client sends "POST /items/<x>/move" with
  `{"columnId":"<k>","before":"<a>"}`
- **THEN** the response is `400` with code `invalid-item` and message
  "before names no item: <a>", and `x` keeps `columnId` `null`
