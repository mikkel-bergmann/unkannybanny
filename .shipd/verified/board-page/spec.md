# board-page

### Requirement: Board page served at the root
id: board-page-served

`createApp` in `src/app.js` SHALL mount `express.static` on the repository's
`public/` directory, resolved from `src/app.js`'s own location, after every
area router and before the `no-route` handler. When a client sends `GET /` or
`GET /index.html`, the system SHALL answer `200` with `public/index.html` and
a `Content-Type` starting `text/html`. API routes SHALL keep answering as
before, and a request the static middleware does not serve SHALL fall
through to the next handler.

#### Scenario: Page at the root
- **WHEN** a client sends `GET /` and `GET /index.html` to an app built by
  `createApp` over a temp store
- **THEN** both answer `200` with `Content-Type` starting `text/html` and the
  same body, which contains `id="item-list"`

#### Scenario: API routes are not shadowed
- **WHEN** a client sends `GET /items` and `GET /tags` to the same app
- **THEN** they answer `200` with `{"items": []}` and `{"tags": []}`

#### Scenario: Static mount sits after the routers
- **WHEN** a test reads `app._router.stack`
- **THEN** the `serveStatic` layer comes after every layer named `router`,
  and before the `noRoute` layer when one is present

#### Scenario: Non-GET to the root is not served
- **WHEN** a client sends `POST /`
- **THEN** the response status is `404`

### Requirement: Board page markup
id: board-page-markup

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

### Requirement: Board adds an item
id: board-add-item

When the user submits the add form, the page SHALL send `POST /items` with
JSON `{"title": <title input>, "tags": <tags>}`, where tags are the tags
input split on commas, each piece trimmed and empty pieces dropped. On `201`
it SHALL clear the form and `#status` and refresh the list and filter. If the
API answers an error, then the page SHALL show the error's `message` in
`#status` and keep the inputs.

#### Scenario: Add with tags
- **WHEN** the user enters title `eggs` and tags ` shop, ,food ` and submits
- **THEN** the request body is `{"title":"eggs","tags":["shop","food"]}`, the
  list shows `eggs` with tags `shop` and `food`, and the form is empty

#### Scenario: Invalid tag shows the server's message
- **WHEN** the user enters title `eggs` and tags `Bad Tag` and submits
- **THEN** `#status` shows the `invalid-item` message from the API and the
  inputs still hold `eggs` and `Bad Tag`

### Requirement: Board toggles done
id: board-done-toggle

When the user changes an item's checkbox, the page SHALL send
`PATCH /items/<id>` with JSON `{"done": <checked>}` and refresh on success.
If the API answers an error, then the page SHALL restore the checkbox to its
previous state and show the error's `message` in `#status`.

#### Scenario: Toggle done
- **WHEN** the user ticks the checkbox of `milk`
- **THEN** the page sends `PATCH /items/<milk id>` with `{"done":true}` and
  `milk` renders checked with class `done` after a reload

### Requirement: Board columns
id: board-columns

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
