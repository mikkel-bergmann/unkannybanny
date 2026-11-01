## MODIFIED Requirements

### Requirement: Board page markup
id: board-page-markup
base: 336d87de7282

`public/index.html` SHALL be a single self-contained HTML document holding an
add form `id="add-form"` with inputs `id="add-title"` and `id="add-tags"`, a
tag filter `id="tag-filter"`, an add-column form `id="column-add-form"` with
input `id="column-add-name"`, an item list `id="item-list"`, and a status
element `id="status"` with `role="status"`. It SHALL hold exactly one inline
classic `<script>` with no `src`, which SHALL compile as a script, SHALL call
the API with `fetch` at `/items`, `/tags`, and `/columns`, and SHALL NOT use
`innerHTML`. The page SHALL load no external resource.

#### Scenario: Fixed ids and one inline script
- **WHEN** a test fetches `GET /` and reads the body
- **THEN** it finds each of the eight ids, exactly one `<script>` tag, no
  `src=` attribute, no `http://` or `https://`, and no `innerHTML`

#### Scenario: Script compiles and names its API calls
- **WHEN** a test extracts the inline script and calls `new vm.Script(src)`
- **THEN** no error is thrown, and the source contains `fetch`, `/items`,
  `/tags`, `/columns`, `?tag=`, `POST`, and `PATCH`

### Requirement: Board lists and filters items
id: board-list-filter
base: 6d69dc6ded8b

When the page loads, it SHALL fetch `GET /items`, `GET /tags`, and
`GET /columns`, and render one lane per column, in column order, inside
`id="item-list"`, plus one trailing lane labelled `Unassigned` holding the items
whose `columnId` is `null` or names no column. Every item SHALL render in its
lane with its title, its done state as a checkbox, and each tag, using
`textContent` for API text. The tag filter SHALL show an `All` button and one
button per `/tags` entry labelled `<tag> (<count>)`, with the active one marked
`aria-pressed="true"`. When the user chooses a tag, the page SHALL render only
the items `GET /items?tag=<tag>` returns, in their lanes; when the user chooses
`All`, it SHALL render every item. If the active tag no longer appears in
`/tags`, then the filter SHALL reset to `All`.

#### Scenario: Items and tags render
- **WHEN** the store holds columns `Backlog` and `Doing`, `milk` tagged `shop` in
  `Backlog`, and `bread` with no column, and a user opens
  `http://127.0.0.1:<port>/`
- **THEN** the board shows a `Backlog` lane holding `milk`, a `Doing` lane holding
  nothing, and an `Unassigned` lane holding `bread`, and the filter shows `All`
  and `shop (1)`

#### Scenario: Choosing a tag narrows the list
- **WHEN** the user clicks `shop (1)`, then `All`
- **THEN** the board shows only `milk`, then both items again

## ADDED Requirements

### Requirement: Board columns
id: board-columns

The page SHALL let a user create, rename, reorder, and remove columns, and move
a card between lanes, each through the API. Submitting `id="column-add-form"`
SHALL send `POST /columns` with JSON `{"name": <column-add-name input>}`. Each
lane header SHALL hold an editable name input that sends `PATCH /columns/<id>`
with `{"name": <new value>}` when it changes, a `◀` and a `▶` button that move
the column one position by sending `PUT /columns/order` with the full id list in
the new order and are disabled at the ends, and a `✕` button that sends
`DELETE /columns/<id>`. Cards SHALL be draggable, and dropping a card on a lane
SHALL send `PATCH /items/<id>` with `{"columnId": <lane's column id, or null for
the Unassigned lane>}`. On any API error the page SHALL show the error's
`message` in `#status` and leave the board as it was.

#### Scenario: Add a column
- **WHEN** the user enters `Doing` in `#column-add-name` and submits the form
- **THEN** the page sends `POST /columns` with `{"name":"Doing"}` and a `Doing`
  lane appears

#### Scenario: Reorder columns
- **WHEN** the user clicks the `▶` button on the first of two lanes
- **THEN** the page sends `PUT /columns/order` naming the two columns in swapped
  order and the lanes swap

#### Scenario: Move a card
- **WHEN** the user drags `milk` from the `Unassigned` lane onto the `Doing`
  lane
- **THEN** the page sends `PATCH /items/<milk id>` with `{"columnId": <Doing id>}`
  and `milk` renders in `Doing`

#### Scenario: Remove a column
- **WHEN** the user clicks the `✕` button on the `Doing` lane
- **THEN** the page sends `DELETE /columns/<Doing id>` and the lane disappears
