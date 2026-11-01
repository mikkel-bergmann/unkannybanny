import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateNewColumn, validateColumnPatch, ColumnValidationError } from "../src/columns.js";
import { createApp } from "../src/app.js";
import { createStore } from "../src/store.js";

function invalid(fn) {
  assert.throws(fn, (err) => err instanceof ColumnValidationError && err.code === "invalid-column");
}

test("validateNewColumn trims the name", () => {
  assert.deepEqual(validateNewColumn({ name: "  Doing  " }), { name: "Doing" });
});

test("validateNewColumn rejects shape violations", () => {
  for (const input of [
    [],
    null,
    {},
    { name: "   " },
    { name: "a".repeat(101) },
    { name: 1 },
    { name: "a", id: "x" },
  ]) {
    invalid(() => validateNewColumn(input));
  }
});

test("validateNewColumn accepts a 100-character name", () => {
  assert.equal(validateNewColumn({ name: "a".repeat(100) }).name.length, 100);
});

test("validateColumnPatch keeps only the provided name", () => {
  assert.deepEqual(validateColumnPatch({ name: "In progress" }), { name: "In progress" });
  invalid(() => validateColumnPatch({}));
  invalid(() => validateColumnPatch({ name: "" }));
});

const servers = [];
async function start() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "banny-columns-"));
  const store = createStore({ path: path.join(dir, "banny.json") });
  const app = createApp({ store });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  servers.push(server);
  return { base: `http://127.0.0.1:${server.address().port}` };
}
after(() => Promise.all(servers.map((s) => new Promise((r) => s.close(r)))));

const JSON_H = { "content-type": "application/json" };
const send = (base, method, url, body, headers = JSON_H) =>
  fetch(base + url, { method, headers, body });

test("create, read, list", async () => {
  const { base } = await start();
  const res = await send(base, "POST", "/columns", JSON.stringify({ name: "Doing" }));
  assert.equal(res.status, 201);
  const column = await res.json();
  assert.equal(res.headers.get("location"), `/columns/${column.id}`);
  assert.equal(column.name, "Doing");
  assert.equal(typeof column.createdAt, "string");
  const list = await fetch(`${base}/columns`);
  assert.equal(list.status, 200);
  assert.deepEqual(await list.json(), { columns: [column] });
});

test("rename and remove", async () => {
  const { base } = await start();
  const column = await (await send(base, "POST", "/columns", '{"name":"Doing"}')).json();
  const patched = await send(base, "PATCH", `/columns/${column.id}`, '{"name":"In progress"}');
  assert.equal(patched.status, 200);
  assert.equal((await patched.json()).name, "In progress");
  const del = await fetch(`${base}/columns/${column.id}`, { method: "DELETE" });
  assert.equal(del.status, 204);
  assert.equal(await del.text(), "");
  assert.deepEqual(await (await fetch(`${base}/columns`)).json(), { columns: [] });
});

test("reorder applies a permutation", async () => {
  const { base } = await start();
  const a = await (await send(base, "POST", "/columns", '{"name":"a"}')).json();
  const b = await (await send(base, "POST", "/columns", '{"name":"b"}')).json();
  const c = await (await send(base, "POST", "/columns", '{"name":"c"}')).json();
  const res = await send(base, "PUT", "/columns/order", JSON.stringify({ ids: [c.id, a.id, b.id] }));
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).columns.map((x) => x.name), ["c", "a", "b"]);
  assert.deepEqual(
    (await (await fetch(`${base}/columns`)).json()).columns.map((x) => x.name),
    ["c", "a", "b"],
  );
});

test("bad reorder is refused and leaves the order", async () => {
  const { base } = await start();
  const a = await (await send(base, "POST", "/columns", '{"name":"a"}')).json();
  await send(base, "POST", "/columns", '{"name":"b"}');
  for (const body of ['{"ids":[]}', '{"ids":["a"]}', JSON.stringify({ ids: [a.id, a.id] }), '{"ids":"x"}']) {
    const res = await send(base, "PUT", "/columns/order", body);
    assert.equal(res.status, 400, body);
    assert.equal((await res.json()).error.code, "invalid-column");
  }
  assert.deepEqual(
    (await (await fetch(`${base}/columns`)).json()).columns.map((x) => x.name),
    ["a", "b"],
  );
});

test("unknown id answers 404 not-found", async () => {
  const { base } = await start();
  const patch = await send(base, "PATCH", "/columns/no-such-id", '{"name":"x"}');
  assert.equal(patch.status, 404);
  assert.equal((await patch.json()).error.code, "not-found");
  const del = await fetch(`${base}/columns/no-such-id`, { method: "DELETE" });
  assert.equal(del.status, 404);
  assert.equal((await del.json()).error.code, "not-found");
});

test("invalid columns are refused and the store is unchanged", async () => {
  const { base } = await start();
  const res = await send(base, "POST", "/columns", '{"name":""}');
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, "invalid-column");
  assert.deepEqual(await (await fetch(`${base}/columns`)).json(), { columns: [] });
});

test("malformed JSON answers 400 invalid-json", async () => {
  const { base } = await start();
  const res = await send(base, "POST", "/columns", "{bad");
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, "invalid-json");
});

test("non-JSON content type answers 415", async () => {
  const { base } = await start();
  const res = await send(base, "POST", "/columns", '{"name":"Doing"}', { "content-type": "text/plain" });
  assert.equal(res.status, 415);
  assert.equal((await res.json()).error.code, "unsupported-media-type");
});
