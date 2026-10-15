import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { filterItems, countTags, InvalidQueryError } from "../src/routes/tags.js";
import { createApp } from "../src/app.js";
import { createStore } from "../src/store.js";

const milk = { id: "1", title: "milk", done: false, tags: ["shop", "food"] };
const bread = { id: "2", title: "bread", done: false, tags: ["shop"] };
const mum = { id: "3", title: "call mum", done: false, tags: [] };
const items = [milk, bread, mum];

test("filterItems filters by tag and q", () => {
  assert.deepEqual(filterItems(items, {}), items);
  assert.deepEqual(filterItems(items, { tag: "shop" }), [milk, bread]);
  assert.deepEqual(filterItems(items, { tag: ["shop", "food"] }), [milk]);
  assert.deepEqual(filterItems(items, { q: " MIL " }), [milk]);
  assert.deepEqual(filterItems(items, { q: "  " }), items);
  assert.deepEqual(filterItems(items, { q: "br", tag: "food" }), []);
  assert.deepEqual(filterItems(items, { other: "x" }), items);
});

test("filterItems rejects malformed filters", () => {
  for (const query of [
    { tag: "Bad Tag" },
    { tag: "" },
    { tag: { x: "y" } },
    { tag: ["shop", 1] },
    { q: ["a", "b"] },
  ]) {
    assert.throws(
      () => filterItems(items, query),
      (err) => err instanceof InvalidQueryError && err.code === "invalid-query" && err.status === 400,
    );
  }
});

test("countTags counts and sorts tags", () => {
  assert.deepEqual(countTags(items), [{ tag: "food", count: 1 }, { tag: "shop", count: 2 }]);
  assert.deepEqual(countTags([]), []);
});

const servers = [];
after(() => Promise.all(servers.map((s) => new Promise((r) => s.close(r)))));

async function start() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "banny-"));
  const app = createApp({ store: createStore({ path: path.join(dir, "banny.json") }) });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  servers.push(server);
  return `http://127.0.0.1:${server.address().port}`;
}

async function seed(base) {
  for (const body of [
    { title: "milk", tags: ["shop", "food"] },
    { title: "bread", tags: ["shop"] },
    { title: "call mum" },
  ]) {
    const res = await fetch(base + "/items", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    assert.equal(res.status, 201);
  }
}

test("GET /items filters over HTTP", async () => {
  const base = await start();
  await seed(base);
  const titles = async (qs) => {
    const res = await fetch(base + "/items" + qs);
    assert.equal(res.status, 200);
    return (await res.json()).items.map((i) => i.title);
  };
  assert.deepEqual(await titles("?tag=shop"), ["milk", "bread"]);
  assert.deepEqual(await titles("?tag=shop&tag=food"), ["milk"]);
  assert.deepEqual(await titles("?q=%20MIL%20"), ["milk"]);
  assert.deepEqual(await titles("?q="), ["milk", "bread", "call mum"]);
  const res = await fetch(base + "/items?q=br&tag=food");
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { items: [] });
});

test("GET /items refuses malformed filters", async () => {
  const base = await start();
  for (const qs of ["?tag=Bad%20Tag", "?tag=", "?tag[x]=y", "?q=a&q=b"]) {
    const res = await fetch(base + "/items" + qs);
    assert.equal(res.status, 400, qs);
    const body = await res.json();
    assert.equal(body.error.code, "invalid-query");
    assert.equal(typeof body.error.message, "string");
  }
});

test("GET /tags counts tags", async () => {
  const base = await start();
  const empty = await fetch(base + "/tags");
  assert.equal(empty.status, 200);
  assert.deepEqual(await empty.json(), { tags: [] });
  await seed(base);
  const res = await fetch(base + "/tags");
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { tags: [{ tag: "food", count: 1 }, { tag: "shop", count: 2 }] });
});
