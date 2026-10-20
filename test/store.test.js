import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
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
  assert.deepEqual(Object.keys(item), [
    "id",
    "title",
    "done",
    "tags",
    "columnId",
    "createdAt",
    "updatedAt",
  ]);
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

test("a failed write rejects, leaves no temp file, and keeps the prior state", { skip: process.getuid?.() === 0 }, async () => {
  const dir = await tmpDir();
  const store = createStore({ path: path.join(dir, "banny.json") });
  const first = await store.create(sample);
  await fs.chmod(dir, 0o555);
  try {
    await assert.rejects(store.create({ title: "b", done: false, tags: [] }));
    assert.deepEqual(await fs.readdir(dir), ["banny.json"]);
    assert.deepEqual(await store.list(), [first]);
  } finally {
    await fs.chmod(dir, 0o755);
  }
});

test("the data directory is ignored by git", () => {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const result = spawnSync("git", ["check-ignore", "-q", "data/banny.json"], { cwd: root });
  assert.equal(result.status, 0);
});

test("columns list empty for a missing file and for a file without columns", async () => {
  const missing = createStore({ path: path.join(await tmpDir(), "banny.json") });
  assert.deepEqual(await missing.listColumns(), []);
  const file = path.join(await tmpDir(), "banny.json");
  await fs.writeFile(file, JSON.stringify({ items: [{ id: "1", title: "a", done: false, tags: [], createdAt: "c", updatedAt: "c" }] }));
  const store = createStore({ path: file });
  assert.deepEqual(await store.listColumns(), []);
  assert.equal((await store.list()).length, 1);
});

test("createColumn assigns a UUID and equal ISO timestamps", async () => {
  const file = path.join(await tmpDir(), "banny.json");
  const store = createStore({ path: file });
  const column = await store.createColumn({ name: "Backlog" });
  assert.match(column.id, UUID);
  assert.equal(column.name, "Backlog");
  assert.equal(column.createdAt, column.updatedAt);
  assert.deepEqual(Object.keys(column), ["id", "name", "createdAt", "updatedAt"]);
  const parsed = JSON.parse(await fs.readFile(file, "utf8"));
  assert.deepEqual(parsed.columns, [column]);
});

test("updateColumn changes only name and updatedAt", async () => {
  const store = createStore({ path: path.join(await tmpDir(), "banny.json") });
  const column = await store.createColumn({ name: "Backlog" });
  const updated = await store.updateColumn(column.id, { name: "Doing", id: "x" });
  assert.equal(updated.name, "Doing");
  assert.equal(updated.id, column.id);
  assert.equal(updated.createdAt, column.createdAt);
  assert.ok(updated.updatedAt >= updated.createdAt);
  assert.equal(await store.updateColumn("no-such-id", { name: "x" }), null);
});

test("removeColumn unassigns its items", async () => {
  const store = createStore({ path: path.join(await tmpDir(), "banny.json") });
  const column = await store.createColumn({ name: "Doing" });
  const item = await store.create({ title: "milk", done: false, tags: [], columnId: column.id });
  assert.equal(await store.removeColumn(column.id), true);
  assert.deepEqual(await store.listColumns(), []);
  assert.equal((await store.get(item.id)).columnId, null);
  assert.equal(await store.removeColumn(column.id), false);
});

test("reorderColumns applies a permutation and rejects anything else", async () => {
  const store = createStore({ path: path.join(await tmpDir(), "banny.json") });
  const a = await store.createColumn({ name: "a" });
  const b = await store.createColumn({ name: "b" });
  assert.equal(await store.reorderColumns([a.id]), null);
  assert.equal(await store.reorderColumns([a.id, a.id]), null);
  assert.equal(await store.reorderColumns([a.id, "nope"]), null);
  assert.deepEqual((await store.listColumns()).map((c) => c.name), ["a", "b"]);
  const reordered = await store.reorderColumns([b.id, a.id]);
  assert.deepEqual(reordered.map((c) => c.name), ["b", "a"]);
  assert.deepEqual((await store.listColumns()).map((c) => c.name), ["b", "a"]);
});

test("returned columns are copies", async () => {
  const store = createStore({ path: path.join(await tmpDir(), "banny.json") });
  await store.createColumn({ name: "orig" });
  const first = await store.listColumns();
  first[0].name = "changed";
  assert.equal((await store.listColumns())[0].name, "orig");
});

test("a board with no columns writes the original items-only shape", async () => {
  const file = path.join(await tmpDir(), "banny.json");
  const store = createStore({ path: file });
  await store.create(sample);
  const parsed = JSON.parse(await fs.readFile(file, "utf8"));
  assert.deepEqual(Object.keys(parsed), ["items"]);
});

test("create and update refuse a column that no longer exists", async () => {
  const dir = await tmpDir();
  const store = createStore({ path: path.join(dir, "banny.json") });
  const column = await store.createColumn({ name: "todo" });
  const item = await store.create({ ...sample, columnId: column.id });
  await store.removeColumn(column.id);
  await assert.rejects(store.create({ ...sample, columnId: column.id }), {
    name: "ItemValidationError",
    message: `columnId names no column: ${column.id}`,
  });
  await assert.rejects(store.update(item.id, { columnId: column.id }), {
    name: "ItemValidationError",
  });
  assert.equal((await store.list()).length, 1);
  assert.equal((await store.update(item.id, { title: "b" })).title, "b");
});

test("moveItem places an item before another within a lane", async () => {
  const store = createStore({ path: path.join(await tmpDir(), "banny.json") });
  const k = await store.createColumn({ name: "k" });
  const a = await store.create({ ...sample, title: "a", columnId: k.id });
  const b = await store.create({ ...sample, title: "b", columnId: k.id });
  const c = await store.create({ ...sample, title: "c", columnId: k.id });
  const moved = await store.moveItem(c.id, { columnId: k.id, before: a.id });
  assert.equal(moved.id, c.id);
  assert.deepEqual((await store.list()).map((i) => i.id), [c.id, a.id, b.id]);
});

test("moveItem places an item before a later one when moving down", async () => {
  const store = createStore({ path: path.join(await tmpDir(), "banny.json") });
  const a = await store.create({ ...sample, title: "a" });
  const b = await store.create({ ...sample, title: "b" });
  const c = await store.create({ ...sample, title: "c" });
  await store.moveItem(a.id, { columnId: null, before: c.id });
  assert.deepEqual((await store.list()).map((i) => i.id), [b.id, a.id, c.id]);
});

test("moveItem moves across lanes to a position", async () => {
  const store = createStore({ path: path.join(await tmpDir(), "banny.json") });
  const k = await store.createColumn({ name: "k" });
  const m = await store.createColumn({ name: "m" });
  const a = await store.create({ ...sample, title: "a", columnId: k.id });
  const b = await store.create({ ...sample, title: "b", columnId: k.id });
  const x = await store.create({ ...sample, title: "x", columnId: m.id });
  const moved = await store.moveItem(x.id, { columnId: k.id, before: b.id });
  assert.equal(moved.columnId, k.id);
  assert.deepEqual((await store.list()).map((i) => i.id), [a.id, x.id, b.id]);
});

test("moveItem with before null moves to the end", async () => {
  const store = createStore({ path: path.join(await tmpDir(), "banny.json") });
  const a = await store.create({ ...sample, title: "a" });
  const b = await store.create({ ...sample, title: "b" });
  await store.moveItem(a.id, { columnId: null, before: null });
  assert.deepEqual((await store.list()).map((i) => i.id), [b.id, a.id]);
});

test("moveItem on an unknown id resolves null and leaves the file alone", async () => {
  const file = path.join(await tmpDir(), "banny.json");
  const store = createStore({ path: file });
  await store.create(sample);
  const text = await fs.readFile(file, "utf8");
  assert.equal(await store.moveItem("no-such-id", { columnId: null, before: null }), null);
  assert.equal(await fs.readFile(file, "utf8"), text);
});

test("an existing file keeps its order and is not rewritten", async () => {
  const file = path.join(await tmpDir(), "banny.json");
  const mk = (id) => ({ id, title: id, done: false, tags: [], columnId: null, createdAt: "t", updatedAt: "t" });
  const text = JSON.stringify({ items: [mk("a"), mk("b"), mk("c")] });
  await fs.writeFile(file, text);
  const store = createStore({ path: file });
  assert.deepEqual((await store.list()).map((i) => i.id), ["a", "b", "c"]);
  assert.equal(await fs.readFile(file, "utf8"), text);
});
