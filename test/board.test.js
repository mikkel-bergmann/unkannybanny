import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { createApp } from "../src/app.js";
import { createStore } from "../src/store.js";

const servers = [];
after(async () => {
  await Promise.all(servers.map((s) => new Promise((resolve) => s.close(resolve))));
});

async function start() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "banny-"));
  const app = createApp({ store: createStore({ path: path.join(dir, "banny.json") }) });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  servers.push(server);
  return { app, server, base: `http://127.0.0.1:${server.address().port}` };
}

test("GET / and /index.html serve the page", async () => {
  const { base } = await start();
  const a = await fetch(`${base}/`);
  const b = await fetch(`${base}/index.html`);
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.ok(a.headers.get("content-type").startsWith("text/html; charset=UTF-8"));
  assert.ok(b.headers.get("content-type").startsWith("text/html; charset=UTF-8"));
  const bodyA = await a.text();
  assert.equal(bodyA, await b.text());
  assert.ok(bodyA.includes('id="item-list"'));
});

test("the API is not shadowed and unknown methods fall through", async () => {
  const { base } = await start();
  const items = await fetch(`${base}/items`);
  assert.equal(items.status, 200);
  assert.deepEqual(await items.json(), { items: [] });
  const tags = await fetch(`${base}/tags`);
  assert.equal(tags.status, 200);
  assert.deepEqual(await tags.json(), { tags: [] });
  const post = await fetch(`${base}/`, { method: "POST" });
  assert.equal(post.status, 404);
});

test("static mount follows every router and precedes noRoute", async () => {
  const { app } = await start();
  const stack = app._router.stack;
  const staticAt = stack.findIndex((l) => l.name === "serveStatic");
  assert.ok(staticAt >= 0);
  stack.forEach((layer, i) => {
    if (layer.name === "router") assert.ok(staticAt > i);
  });
  const noRouteAt = stack.findIndex((l) => l.name === "noRoute");
  if (noRouteAt >= 0) assert.ok(staticAt < noRouteAt);
});

test("the page has the fixed ids and a single inline script", async () => {
  const { base } = await start();
  const body = await (await fetch(`${base}/`)).text();
  for (const id of [
    "add-form",
    "add-title",
    "add-tags",
    "tag-filter",
    "column-add-form",
    "column-add-name",
    "item-list",
    "status",
  ]) {
    assert.ok(body.includes(`id="${id}"`), id);
  }
  assert.ok(body.includes('role="status"'));
  assert.equal(body.match(/<script\b/g).length, 1);
  for (const banned of ["src=", "http://", "https://", "innerHTML"]) {
    assert.ok(!body.includes(banned), banned);
  }
  const src = body.match(/<script>([\s\S]*?)<\/script>/)[1];
  assert.doesNotThrow(() => new vm.Script(src));
  for (const needle of ["fetch", '"/items"', '"/tags"', '"/columns"', "?tag=", '"POST"', '"PATCH"']) {
    assert.ok(src.includes(needle), needle);
  }
});

test("the script wires card and column drag types and the move route", async () => {
  const { base } = await start();
  const body = await (await fetch(`${base}/`)).text();
  const src = body.match(/<script>([\s\S]*?)<\/script>/)[1];
  for (const needle of ['"/move"', "application/x-banny-item", "application/x-banny-column", "lane-grip"]) {
    assert.ok(src.includes(needle), needle);
  }
});
