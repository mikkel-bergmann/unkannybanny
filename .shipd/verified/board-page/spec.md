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
tag filter `id="tag-filter"`, an item list `id="item-list"`, and a status
element `id="status"` with `role="status"`. It SHALL hold exactly one inline
classic `<script>` with no `src`, which SHALL compile as a script, SHALL call
the API with `fetch` at `/items` and `/tags`, and SHALL NOT use `innerHTML`.
The page SHALL load no external resource.

#### Scenario: Fixed ids and one inline script
- **WHEN** a test fetches `GET /` and reads the body
- **THEN** it finds each of the five ids, exactly one `<script>` tag, no
  `src=` attribute, no `http://` or `https://`, and no `innerHTML`

#### Scenario: Script compiles and names its API calls
- **WHEN** a test extracts the inline script and calls `new vm.Script(src)`
- **THEN** no error is thrown, and the source contains `fetch`, `/items`,
  `/tags`, `?tag=`, `POST`, and `PATCH`

### Requirement: Board lists and filters items
id: board-list-filter

When the page loads, it SHALL fetch `GET /items` and `GET /tags` and render
every item in API order with its title, its done state as a checkbox, and
each tag, using `textContent` for API text. The tag filter SHALL show an
`All` button and one button per `/tags` entry labelled `<tag> (<count>)`,
with the active one marked `aria-pressed="true"`. When the user chooses a
tag, the page SHALL list the result of `GET /items?tag=<tag>`; when the user
chooses `All`, it SHALL list `GET /items`. If the active tag no longer
appears in `/tags`, then the filter SHALL reset to `All`.

#### Scenario: Items and tags render
- **WHEN** the store holds `milk` tagged `["shop"]` and `bread` with no tags
  and a user opens `http://127.0.0.1:<port>/`
- **THEN** the list shows `milk` with tag `shop` and `bread`, and the filter
  shows `All` and `shop (1)`

#### Scenario: Choosing a tag narrows the list
- **WHEN** the user clicks `shop (1)`, then `All`
- **THEN** the list shows only `milk`, then both items

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
