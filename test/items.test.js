import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateNewItem, validateItemPatch, ItemValidationError } from "../src/items.js";
import { createApp } from "../src/app.js";
import { createStore } from "../src/store.js";

function invalid(fn) {
  assert.throws(fn, (err) => err instanceof ItemValidationError && err.code === "invalid-item");
}

test("validateNewItem trims the title and applies defaults", () => {
  assert.deepEqual(validateNewItem({ title: "  milk  " }), { title: "milk", done: false, tags: [] });
});

test("validateNewItem rejects shape violations", () => {
  const elevenTags = Array.from({ length: 11 }, (_, i) => `t${i}`);
  for (const input of [
    [],
    null,
    {},
    { title: "   " },
    { title: "a".repeat(201) },
    { title: "a", done: "yes" },
    { title: "a", tags: "x" },
    { title: "a", tags: ["Bad Tag"] },
    { title: "a", tags: ["x", "x"] },
    { title: "a", tags: elevenTags },
    { title: "a", id: "x" },
  ]) {
    invalid(() => validateNewItem(input));
  }
});

test("validateNewItem accepts boundary values", () => {
  const out = validateNewItem({ title: "a".repeat(200), tags: ["a-1"] });
  assert.equal(out.title.length, 200);
  assert.deepEqual(out.tags, ["a-1"]);
});

test("validateItemPatch keeps only provided keys", () => {
  assert.deepEqual(validateItemPatch({ done: true }), { done: true });
  assert.deepEqual(validateItemPatch({ title: " b " }), { title: "b" });
  invalid(() => validateItemPatch({}));
  invalid(() => validateItemPatch({ createdAt: "y" }));
});

const servers = [];
async function start() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "banny-"));
  const store = createStore({ path: path.join(dir, "banny.json") });
  const app = createApp({ store });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  servers.push(server);
  return { base: `http://127.0.0.1:${server.address().port}`, server };
}
after(() => Promise.all(servers.map((s) => new Promise((r) => s.close(r)))));

const JSON_H = { "content-type": "application/json" };
const send = (base, method, url, body, headers = JSON_H) =>
  fetch(base + url, { method, headers, body });

test("create, read, list", async () => {
  const { base } = await start();
  const res = await send(base, "POST", "/items", JSON.stringify({ title: "milk", tags: ["shop"] }));
  assert.equal(res.status, 201);
  const item = await res.json();
  assert.equal(res.headers.get("location"), `/items/${item.id}`);
  assert.equal(item.title, "milk");
  assert.equal(item.done, false);
  assert.deepEqual(item.tags, ["shop"]);
  assert.equal(typeof item.createdAt, "string");
  assert.equal(typeof item.updatedAt, "string");
  const read = await fetch(`${base}/items/${item.id}`);
  assert.equal(read.status, 200);
  assert.deepEqual(await read.json(), item);
  const list = await fetch(`${base}/items`);
  assert.equal(list.status, 200);
  assert.deepEqual(await list.json(), { items: [item] });
});

test("update and delete", async () => {
  const { base } = await start();
  const item = await (await send(base, "POST", "/items", JSON.stringify({ title: "milk" }))).json();
  const patched = await send(base, "PATCH", `/items/${item.id}`, '{"done":true}');
  assert.equal(patched.status, 200);
  const body = await patched.json();
  assert.equal(body.done, true);
  assert.equal(body.title, "milk");
  const del = await fetch(`${base}/items/${item.id}`, { method: "DELETE" });
  assert.equal(del.status, 204);
  assert.equal(await del.text(), "");
  const gone = await fetch(`${base}/items/${item.id}`);
  assert.equal(gone.status, 404);
  assert.equal((await gone.json()).error.code, "not-found");
});

test("unknown id answers 404 not-found", async () => {
  const { base } = await start();
  for (const res of [
    await fetch(`${base}/items/no-such-id`),
    await send(base, "PATCH", "/items/no-such-id", '{"done":true}'),
    await fetch(`${base}/items/no-such-id`, { method: "DELETE" }),
  ]) {
    assert.equal(res.status, 404);
    assert.equal((await res.json()).error.code, "not-found");
  }
});

test("invalid items are refused and the store is unchanged", async () => {
  const { base } = await start();
  const res = await send(base, "POST", "/items", '{"title":""}');
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, "invalid-item");
  assert.deepEqual(await (await fetch(`${base}/items`)).json(), { items: [] });
  const item = await (await send(base, "POST", "/items", '{"title":"a"}')).json();
  const empty = await send(base, "PATCH", `/items/${item.id}`, "{}");
  assert.equal(empty.status, 400);
  assert.equal((await empty.json()).error.code, "invalid-item");
});

test("malformed JSON answers 400 invalid-json", async () => {
  const { base } = await start();
  const res = await send(base, "POST", "/items", "{bad");
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, "invalid-json");
  assert.equal(typeof body.error.message, "string");
});

test("oversized JSON answers 400 invalid-json", async () => {
  const { base } = await start();
  const res = await send(base, "POST", "/items", JSON.stringify({ title: "a", pad: "x".repeat(200000) }));
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, "invalid-json");
});

test("non-JSON content types answer 415", async () => {
  const { base } = await start();
  const text = { "content-type": "text/plain" };
  const res = await send(base, "POST", "/items", '{"title":"milk"}', text);
  assert.equal(res.status, 415);
  assert.equal((await res.json()).error.code, "unsupported-media-type");
  const none = await fetch(`${base}/items`, { method: "POST" });
  assert.equal(none.status, 415);
  const emptyJson = await fetch(`${base}/items`, { method: "POST", headers: JSON_H });
  assert.equal(emptyJson.status, 415);
  assert.equal((await emptyJson.json()).error.code, "unsupported-media-type");
  const item = await (await send(base, "POST", "/items", '{"title":"a"}')).json();
  const patch = await send(base, "PATCH", `/items/${item.id}`, '{"done":true}', text);
  assert.equal(patch.status, 415);
  assert.deepEqual(await (await fetch(`${base}/items/${item.id}`)).json(), item);
});

test("charset parameter is accepted", async () => {
  const { base } = await start();
  const res = await send(base, "POST", "/items", '{"title":"a"}', {
    "content-type": "application/json; charset=utf-8",
  });
  assert.equal(res.status, 201);
});
