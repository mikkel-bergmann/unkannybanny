## 1. Tests first

- [x] 1.1 [req: board-page-served] Create `test/board.test.js` using
      `node:test`, `node:assert/strict`, and global `fetch`. Add a helper
      that makes a `fs.mkdtemp(path.join(os.tmpdir(), "banny-"))` directory,
      builds `createApp({ store: createStore({ path: <dir>/banny.json }) })`
      (imports from `../src/app.js` and `../src/store.js`), listens on port 0
      at `127.0.0.1`, and returns the app, the base URL, and the server;
      close every server in `after` or `finally`. Tests: `GET /` and
      `GET /index.html` each answer `200` with `content-type` starting
      `text/html; charset=UTF-8` and identical bodies containing `id="item-list"`;
      `GET /items` answers `200` with `{ items: [] }` and `GET /tags` with
      `{ tags: [] }`; `POST /` answers status `404`; in
      `app._router.stack`, the index of the layer with
      `name === "serveStatic"` is greater than the index of every layer with
      `name === "router"`, and less than the index of the layer with
      `name === "noRoute"` when such a layer exists.
- [x] 1.2 [req: board-page-markup] In `test/board.test.js`, add tests on the
      body of `GET /`: it contains `id="add-form"`, `id="add-title"`,
      `id="add-tags"`, `id="tag-filter"`, `id="item-list"`, `id="status"`,
      and `role="status"`; it matches `/<script\b/g` exactly once; it
      contains no `src=`, no `http://`, no `https://`, and no `innerHTML`.
      Extract the script with `body.match(/<script>([\s\S]*?)<\/script>/)[1]`,
      assert `new vm.Script(src)` (import `vm` from `node:vm`) does not
      throw, and assert `src` contains each of `fetch`, `"/items"`,
      `"/tags"`, `?tag=`, `"POST"`, and `"PATCH"`.
- [x] 1.3 [req: board-page-served, board-page-markup] Run `npm test` and
      observe the new tests fail because `public/index.html` does not exist
      and no static middleware is mounted.

## 2. Static mount

- [x] 2.1 [req: board-page-served] In `src/app.js`, add
      `import { fileURLToPath } from "node:url";` and, at module level,
      `const publicDir = fileURLToPath(new URL("../public", import.meta.url));`.
      In `createApp`, add `app.use(express.static(publicDir));` on the line
      directly after the last `app.use(<name>Router(store))` line, and
      before `app.use(noRoute)` when that line exists. Change nothing else.

## 3. Page

- [x] 3.1 [req: board-page-markup] Create `public/index.html`: `<!doctype
      html>`, `<html lang="en">`, `<meta charset="utf-8">`, a viewport meta,
      `<title>Banny board</title>`, and an inline `<style>` (system font, a
      centred column of max width 40rem, `.tag` as small rounded labels,
      `li.done` with `text-decoration: line-through`, and
      `[aria-pressed="true"]` buttons visibly highlighted). Body: `<main>`
      with `<h1>Banny board</h1>`; `<form id="add-form">` holding
      `<input id="add-title" name="title" required maxlength="200"
      placeholder="New item">`, `<input id="add-tags" name="tags"
      placeholder="tags, comma, separated">`, and
      `<button type="submit">Add</button>`;
      `<nav id="tag-filter" aria-label="Filter by tag"></nav>`;
      `<ul id="item-list"></ul>`;
      `<p id="status" role="status" aria-live="polite"></p>`; then one
      inline `<script>` holding the code from tasks 3.2 to 3.5. Use no
      `import`, `export`, top-level `await`, `innerHTML`, or external URL.
- [x] 3.2 [req: board-list-filter, board-add-item, board-done-toggle] In the
      script, define `let activeTag = null;`, `const $ = (id) =>
      document.getElementById(id);`, `showStatus(text)` setting
      `$("status").textContent = text`, and `async function api(method,
      path, body)`: call `fetch(path, { method, headers: body === undefined
      ? {} : { "content-type": "application/json" }, body: body ===
      undefined ? undefined : JSON.stringify(body) })`; on a rejected
      `fetch`, throw `new Error("Could not reach the server")`; when
      `res.status === 204` return `null`; parse `await res.json()`; when
      `!res.ok` throw `new Error(data?.error?.message ?? "Request failed")`;
      else return `data`.
- [x] 3.3 [req: board-list-filter] In the script, define
      `renderTags(tags)`: if `activeTag` is not `null` and no entry has
      `tag === activeTag`, set `activeTag = null`; clear `#tag-filter` with
      `replaceChildren()`; append a `<button type="button">` labelled `All`
      and one per entry labelled `` `${tag} (${count})` ``, each with
      `aria-pressed` `"true"` when it is active (`All` when `activeTag ===
      null`) else `"false"`, and a click handler that sets `activeTag` (or
      `null` for `All`) and calls `refresh()`. Define `renderItems(items)`:
      clear `#item-list`; when empty append `<li class="empty">No
      items</li>`; else per item append an `<li>` (class `done` when
      `item.done`) holding a `<label>` with an `<input type="checkbox">`
      (`checked = item.done`) and a `<span>` whose `textContent` is the
      title, then one `<span class="tag">` per tag with `textContent` set to
      the tag. Define `async function refresh()`: `const { tags } = await
      api("GET", "/tags")`; call `renderTags(tags)` (which may reset
      `activeTag`); then `const { items } = await api("GET", activeTag ===
      null ? "/items" : "/items?tag=" + encodeURIComponent(activeTag))` and
      call `renderItems(items)`; wrap the body in `try`/`catch` and on error
      call `showStatus(err.message)`.
- [x] 3.4 [req: board-add-item] In the script, add a `submit` listener on
      `#add-form`: `event.preventDefault()`; `title = $("add-title").value`;
      `tags = $("add-tags").value.split(",").map((s) =>
      s.trim()).filter(Boolean)`; `await api("POST", "/items", { title, tags
      })`; on success call `$("add-form").reset()`, `showStatus("")`, and
      `await refresh()`; on error call `showStatus(err.message)` and leave
      the inputs untouched.
- [x] 3.5 [req: board-done-toggle, board-list-filter] In the script, have
      each checkbox from task 3.3 register a `change` listener: `await
      api("PATCH", "/items/" + encodeURIComponent(item.id), { done:
      checkbox.checked })`, then `showStatus("")` and `await refresh()`; on
      error set `checkbox.checked = !checkbox.checked` and call
      `showStatus(err.message)`. At the end of the script call `refresh()`.

## 4. Verify

- [x] 4.1 [req: *] Run `npm test` and confirm every test passes, including
      `test/items.test.js` and `test/tags.test.js`. Then run
      `BANNY_DATA=<tmp>/banny.json PORT=4399 npm start`, open
      `http://127.0.0.1:4399/` in a browser, and confirm by hand: adding
      `milk` with tags `shop, food` lists it with both tags and the filter
      shows `food (1)` and `shop (1)`; adding tags `Bad Tag` shows the
      server's message in the status line; ticking `milk` strikes it through
      and it stays ticked after a reload; choosing `shop (1)` lists only
      tagged items and `All` lists every item. Stop the server.
