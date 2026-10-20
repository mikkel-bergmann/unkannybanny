## MODIFIED Requirements

### Requirement: Board columns
id: board-columns
base: 676e0baba4b9

The page SHALL let a user create, rename, reorder, and remove columns, and move
a card to a position in any lane, each through the API. Submitting
`id="column-add-form"` SHALL send `POST /columns` with JSON
`{"name": <column-add-name input>}`. Each lane SHALL render its cards in the
order `GET /items` returns them. Each column lane header SHALL hold a draggable
grip `☰` with class `lane-grip`, an editable name input that sends
`PATCH /columns/<id>` with `{"name": <new value>}` when it changes, a `◀` and a
`▶` button that move the column one position and are disabled at the ends, and
a `✕` button that sends `DELETE /columns/<id>`; the `◀`/`▶` buttons SHALL stay
the keyboard path for reordering. Dragging a grip and dropping it on another
column lane SHALL move the dragged column to that lane's position, and dropping
it on the `Unassigned` lane SHALL move it to the last position; every column
reorder SHALL send `PUT /columns/order` with the full id list in the new order.
Cards SHALL be draggable. Dropping a card on another card SHALL send
`POST /items/<id>/move` with `{"columnId": <that lane's column id, or null for
the Unassigned lane>, "before": <the target card's id>}`, and dropping it on a
lane outside any card SHALL send the same with `"before": null`; dropping a card
on itself SHALL send nothing. A card drag and a column drag SHALL carry distinct
`dataTransfer` types, `application/x-banny-item` and
`application/x-banny-column`, so neither drop is mistaken for the other. On any
API error the page SHALL show the error's `message` in `#status` and leave the
board as it was.

#### Scenario: Add a column
- **WHEN** the user enters `Doing` in `#column-add-name` and submits the form
- **THEN** the page sends `POST /columns` with `{"name":"Doing"}` and a `Doing`
  lane appears

#### Scenario: Reorder columns
- **WHEN** the user clicks the `▶` button on the first of two lanes
- **THEN** the page sends `PUT /columns/order` naming the two columns in swapped
  order and the lanes swap

#### Scenario: Reorder columns by dragging a header
- **WHEN** the board has lanes `Backlog`, `Doing`, `Done` and the user drags the
  `Done` grip onto the `Backlog` lane
- **THEN** the page sends `PUT /columns/order` naming `Done`, `Backlog`, `Doing`
  and the lanes render in that order

#### Scenario: Reorder a card within its lane
- **WHEN** `Doing` holds `milk` then `bread` and the user drags `bread` onto
  `milk`
- **THEN** the page sends `POST /items/<bread id>/move` with
  `{"columnId": <Doing id>, "before": <milk id>}` and `bread` renders above
  `milk` after a reload

#### Scenario: Move a card across lanes to a position
- **WHEN** `Doing` holds `milk` then `bread`, `eggs` is unassigned, and the user
  drags `eggs` onto `bread`
- **THEN** the page sends `POST /items/<eggs id>/move` with
  `{"columnId": <Doing id>, "before": <bread id>}` and `Doing` renders `milk`,
  `eggs`, `bread`

#### Scenario: Move a card
- **WHEN** the user drags `milk` from the `Unassigned` lane onto the empty area
  of the `Doing` lane
- **THEN** the page sends `POST /items/<milk id>/move` with
  `{"columnId": <Doing id>, "before": null}` and `milk` renders last in `Doing`

#### Scenario: Remove a column
- **WHEN** the user clicks the `✕` button on the `Doing` lane
- **THEN** the page sends `DELETE /columns/<Doing id>` and the lane disappears

#### Scenario: Script names the drag contract
- **WHEN** a test extracts the inline script
- **THEN** the source contains `/move`, `application/x-banny-item`,
  `application/x-banny-column`, and `lane-grip`, and still compiles with
  `new vm.Script(src)`
