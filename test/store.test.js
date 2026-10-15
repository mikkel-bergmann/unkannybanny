import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createStore } from "../src/store.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

async function tmpDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), "banny-"));
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

const sample = { title: "a", done: false, tags: [] };

test("explicit path wins and nothing is written under data/", async () => {
  const dir = await tmpDir();
  const file = path.join(dir, "banny.json");
  const before = await exists(path.resolve("data/banny.json"));
  const store = createStore({ path: file });
  await store.create(sample);
  const parsed = JSON.parse(await fs.readFile(file, "utf8"));
  assert.equal(parsed.items.length, 1);
  assert.equal(await exists(path.resolve("data/banny.json")), before);
});

test("BANNY_DATA sets the default path", async () => {
  const dir = await tmpDir();
  const file = path.join(dir, "env.json");
  const prev = process.env.BANNY_DATA;
  process.env.BANNY_DATA = file;
  try {
    const store = createStore();
    await store.create(sample);
  } finally {
    if (prev === undefined) delete process.env.BANNY_DATA;
    else process.env.BANNY_DATA = prev;
  }
  const parsed = JSON.parse(await fs.readFile(file, "utf8"));
  assert.equal(parsed.items.length, 1);
});

test("missing file lists [] and is not created", async () => {
  const dir = await tmpDir();
  const file = path.join(dir, "banny.json");
  const store = createStore({ path: file });
  assert.deepEqual(await store.list(), []);
  assert.equal(await exists(file), false);
});

test("get of an unknown id is null", async () => {
  const store = createStore({ path: path.join(await tmpDir(), "banny.json") });
  assert.equal(await store.get("no-such-id"), null);
});

test("returned items are copies", async () => {
  const store = createStore({ path: path.join(await tmpDir(), "banny.json") });
  await store.create({ title: "orig", done: false, tags: ["x"] });
  const first = await store.list();
  first[0].title = "changed";
  first[0].tags.push("y");
  const second = await store.list();
  assert.equal(second[0].title, "orig");
  assert.deepEqual(second[0].tags, ["x"]);
});

test("create assigns a UUID and equal ISO timestamps", async () => {
  const store = createStore({ path: path.join(await tmpDir(), "banny.json") });
  const item = await store.create(sample);
  assert.match(item.id, UUID);
  assert.equal(item.createdAt, item.updatedAt);
  assert.equal(new Date(item.createdAt).toISOString(), item.createdAt);
  assert.deepEqual(Object.keys(item), ["id", "title", "done", "tags", "createdAt", "updatedAt"]);
});

test("update ignores id and createdAt in the patch", async () => {
  const store = createStore({ path: path.join(await tmpDir(), "banny.json") });
  const item = await store.create(sample);
  const updated = await store.update(item.id, { done: true, id: "x", createdAt: "y" });
  assert.equal(updated.done, true);
  assert.equal(updated.id, item.id);
  assert.equal(updated.createdAt, item.createdAt);
  assert.ok(updated.updatedAt >= updated.createdAt);
});

test("update and remove of an unknown id leave the file unchanged", async () => {
  const dir = await tmpDir();
  const file = path.join(dir, "banny.json");
  const store = createStore({ path: file });
  await store.create(sample);
  const before = await fs.readFile(file);
  assert.equal(await store.update("no-such-id", { done: true }), null);
  assert.equal(await store.remove("no-such-id"), false);
  assert.deepEqual(await fs.readFile(file), before);
});

test("50 overlapping creates all land", async () => {
  const file = path.join(await tmpDir(), "banny.json");
  const store = createStore({ path: file });
  await Promise.all(Array.from({ length: 50 }, (_, i) => store.create({ title: `t${i}`, done: false, tags: [] })));
  const parsed = JSON.parse(await fs.readFile(file, "utf8"));
  assert.equal(parsed.items.length, 50);
  assert.equal(new Set(parsed.items.map((i) => i.id)).size, 50);
  assert.equal((await store.list()).length, 50);
});

test("no temp files remain", async () => {
  const dir = await tmpDir();
  const store = createStore({ path: path.join(dir, "banny.json") });
  const item = await store.create(sample);
  await store.update(item.id, { done: true });
  await store.remove(item.id);
  assert.deepEqual(await fs.readdir(dir), ["banny.json"]);
});

test("an outside write is seen", async () => {
  const file = path.join(await tmpDir(), "banny.json");
  const store = createStore({ path: file });
  await store.create(sample);
  const others = [
    { id: "1", title: "other one", done: false, tags: [], createdAt: "c", updatedAt: "c" },
    { id: "2", title: "other two", done: true, tags: ["z"], createdAt: "c", updatedAt: "c" },
  ];
  await fs.writeFile(file, JSON.stringify({ items: others }));
  assert.deepEqual(await store.list(), others);
});

test("a corrupt file rejects and is never overwritten", async () => {
  const file = path.join(await tmpDir(), "banny.json");
  await fs.writeFile(file, "not json");
  const store = createStore({ path: file });
  await assert.rejects(store.create(sample), (err) => {
    assert.equal(err.code, "store-corrupt");
    assert.ok(err.message.includes(file));
    return true;
  });
  assert.equal(await fs.readFile(file, "utf8"), "not json");
});

test("a file without an items array is corrupt", async () => {
  const file = path.join(await tmpDir(), "banny.json");
  await fs.writeFile(file, "{}");
  const store = createStore({ path: file });
  await assert.rejects(store.list(), { code: "store-corrupt" });
});
