# board-page
Status: verified
Epic: unkannybanny

## Idea

Add `public/index.html`, a static board page with inline vanilla JS that
lists items with their tags, adds items, toggles done, and filters by tag,
served at `/` by `express.static`.

### Motivation

Someone running `npm start` today has only a JSON API at
`http://127.0.0.1:4321/` and must use curl or the CLI to see or change the
board. The epic's success criterion is that `npm start` serves the board at
that address, and board-page is the member that delivers it.

### Details

- `public/index.html`: one HTML file, inline `<style>` and one inline
  classic `<script>`, no external resources.
- `src/app.js`: one `app.use(express.static(publicDir))` line after the
  routers and before `noRoute`.
- `test/board.test.js`: served-page, markup, script-compile, and mount-order
  tests on port 0.

Affected capabilities: `board-page` (added). Consumes items-api (`GET /items`,
`POST /items`, `PATCH /items/:id`) and tags-and-search (`?tag=`, `GET /tags`);
no new dependency.

### Non-goals

- No delete or title-edit controls, no search box, no `done` filter.
- No framework, bundler, CDN, external stylesheet, or second static file.
- No browser automation; behaviour beyond the markup is checked by hand.
- No API, store, CLI, or README change.

## Implementation

- **Static mount.** `src/app.js` computes
  `const publicDir = fileURLToPath(new URL("../public", import.meta.url))`
  (import `fileURLToPath` from `node:url`) and mounts
  `app.use(express.static(publicDir))` directly after the last router line
  and before `app.use(noRoute)` when request-logging has merged. Resolving
  from `import.meta.url` keeps it independent of the working directory.
  Default options: `GET /` serves the page; other paths and non-GET methods
  fall through to `noRoute`. Routers come first, so the API is never
  shadowed. Rejected: a custom `GET /` route duplicating `express.static`.
- **Page structure.** Fixed ids are the test contract: `add-form` with
  inputs `add-title` (`maxlength="200"`, `required`) and `add-tags`;
  `tag-filter` (a `<nav>` of buttons); `item-list` (a `<ul>`); `status` (a
  `<p role="status" aria-live="polite">`).
- **Script shape.** One classic inline `<script>` at the end of `<body>`: no
  `import`/`export`, no top-level `await`, so `node:vm` compiles it. A helper
  `api(method, path, body)` calls `fetch`, sends
  `content-type: application/json` and `JSON.stringify(body)` when a body is
  given, returns `null` on `204`, else the parsed JSON, and on a non-OK
  status throws an `Error` carrying `body.error.message`. A network failure
  shows `Could not reach the server`.
- **Rendering.** Built with `document.createElement` and `textContent` only;
  the script never uses `innerHTML`, so a title cannot inject markup. Each
  item is an `<li>` holding a checkbox (checked when `done`), the title, and
  one `<span class="tag">` per tag; done items get class `done`
  (strike-through). Items render in API order; an empty list shows one
  `<li class="empty">No items</li>`.
- **Refresh.** `refresh()` fetches `GET /tags`, renders the filter, then
  fetches and renders the item list for the active tag. It runs on load and
  after every successful mutation.
- **Tag filter (Q1).** Single-select: an `All` button, then one button per
  `/tags` entry labelled `<tag> (<count>)`; the active button has
  `aria-pressed="true"`. Choosing a tag loads
  `GET /items?tag=<encodeURIComponent(tag)>`; `All` loads `GET /items`. If
  the active tag is absent from a fresh `/tags`, it resets to `All`.
- **Add form (Q2).** On submit: `preventDefault`; tags are
  `value.split(",").map(s => s.trim()).filter(Boolean)`; `POST /items` with
  `{ title, tags }`. On `201`, reset the form, clear `#status`, refresh. On
  error, show the API's message in `#status` and keep the inputs. The
  server's validator is the only judge of the shape.
- **Done toggle.** On checkbox `change`, `PATCH /items/<id>` with
  `{ done: checkbox.checked }`; on success refresh, on error revert the
  checkbox and show the message.
- **Tests (Q3).** `test/board.test.js` reads the served page and checks the
  ids, the API paths and methods it names, the absence of `innerHTML` and
  external URLs, compiles the script with `new vm.Script(src)`, and checks
  the mount order via `app._router.stack`.

Risk: seed-and-export's export router may merge after this member; its
`app.use` line belongs before the static line, per the epic's fixed order,
and the mount-order test asserts static follows every router layer.

Risk: the page's runtime behaviour has no automated test; the compile check
catches syntax errors, and the final task checks behaviour by hand.

## Questions and answers

### Q1: How does the tag filter behave?
- **Question:** Options: (1) a single-select row of tag buttons from
  `GET /tags` labelled `<tag> (<count>)` plus `All`, choosing one loads
  `GET /items?tag=<t>`, a vanished tag resets to `All`; (2) multi-select
  buttons combined with AND; (3) a `<select>` dropdown. Recommendation: (1).
- **Verdict:** INSUFFICIENT
- **Answered by:** USER
- **Answer:** Option 1: one active tag is the simplest filter to read, and
  the counts come straight from `GET /tags`.
- **Queued:** q-board-page-tag-filter-behavior

### Q2: How does the add form take tags?
- **Question:** Options: (1) one comma-separated text input, pieces trimmed
  and empties dropped, sent as-is with the server's error message shown;
  (2) a whitespace-separated input; (3) a client-side chip editor validating
  kebab-case. Recommendation: (1).
- **Verdict:** INSUFFICIENT
- **Answered by:** USER
- **Answer:** Option 1: `src/items.js` stays the only validator, as the
  epic requires, and the page needs no second copy of the tag rules.
- **Queued:** q-board-page-add-form-tag-input

### Q3: How deep do the page tests go?
- **Question:** Options: (1) served `200` `text/html`, fixed ids, API paths,
  and the inline script compiled with `new vm.Script`; (2) also run the
  script against a hand-written DOM stub and fake `fetch`; (3) served and
  ids only. Recommendation: (1).
- **Verdict:** INSUFFICIENT
- **Answered by:** USER
- **Answer:** Option 1: it catches a broken page or a syntax error with no
  test framework or DOM library, per the epic's tooling Decision.
- **Queued:** q-board-page-test-depth

## Readiness attestation

### Problem and motivation

Nobody can see or use the board in a browser; the epic's success criterion
needs a page at `/`.

Evidence:

- Epic `unkannybanny` Introduction: "`npm start` serves the board at
  `http://127.0.0.1:4321/`".
- Epic Changes row `board-page`: list items with tags, add form, done
  toggle, tag filter, served at `/`.

### Scope and non-goals

One page, one mount line, one test file; delete, edit, search, and the API
stay out.

Evidence:

- Epic Non-goals: "the board page is one static HTML file with inline
  script"; no frontend framework.
- Epic Design: `createApp` mounts routers, "then the static page, then the
  `no-route` handler".

### Affected capabilities and files

One new capability, `board-page`; files `public/index.html`,
`test/board.test.js` (new) and `src/app.js` (edited).

Evidence:

- Capability `board-page` (added); the library is empty.
- `src/app.js` per app-scaffold `app-factory`; mount lines per items-api
  task 4.1, tags-and-search task 3.2, request-logging task 2.4.
- API shapes: items-api `items-routes`; tags-and-search `items-filters`,
  `tags-route`; store `createStore({ path })` per json-store Q1.
- Runnable premise: an Express 4.22.3 probe mounting a JSON route,
  `express.static` on a `fileURLToPath(new URL(...))` directory, and a JSON
  404 handler answered `GET /` and `GET /index.html` `200`
  `text/html; charset=UTF-8`, `POST /` and `GET /nope` `404` from the
  handler, and `GET /items` `200` JSON.
- Runnable premise: `new vm.Script(src)` compiled the extracted inline
  script and threw `SyntaxError` on `const x = ;`.

### No open task-shaping decision

Every task-shaping decision is settled.

Evidence:

- Tag filter: planner default, Q1. Tags input: planner default, Q2. Test
  depth: planner default, Q3.
- Mount position and static file: the epic's Design and Non-goals.
- Update verb and list envelope: items-api Q1, Q2; tag matching and
  `/tags` shape: tags-and-search Q2, Q5.
