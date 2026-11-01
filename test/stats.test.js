import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createStore } from "../src/store.js";
import { createApp } from "../src/app.js";
import { computeStats } from "../src/routes/stats.js";

const BIN = fileURLToPath(new URL("../bin/banny.js", import.meta.url));

function banny(dataFile, ...args) {
  return spawnSync(process.execPath, [BIN, ...args], {
    env: { ...process.env, BANNY_DATA: dataFile },
    encoding: "utf8",
  });
}

async function tmpFile() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "banny-stats-"));
  return { dir, file: path.join(dir, "banny.json") };
}

async function seeded() {
  const { dir, file } = await tmpFile();
  const store = createStore({ path: file });
  await store.create({ title: "milk", done: false, tags: ["shop", "kitchen"] });
  await store.create({ title: "bread", done: true, tags: ["shop"] });
  await store.create({ title: "plant", done: true, tags: [] });
  return { dir, file, store };
}

async function withServer(file, fn) {
  const server = createApp({ store: createStore({ path: file }) }).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    return await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

const SEEDED_STATS = { total: 3, done: 2, open: 1, tags: 2, columns: [], unassigned: 3 };

test("GET /stats counts items, done, open and distinct tags", async () => {
  const { file } = await seeded();
  await withServer(file, async (base) => {
    const res = await fetch(base + "/stats");
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), SEEDED_STATS);
  });
});

test("GET /stats on an empty store is all zeros", async () => {
  const { file } = await tmpFile();
  await withServer(file, async (base) => {
    const res = await fetch(base + "/stats");
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { total: 0, done: 0, open: 0, tags: 0, columns: [], unassigned: 0 });
  });
});

test("computeStats counts items per column in board order, unassigned last", () => {
  const columns = [
    { id: "b", name: "Backlog" },
    { id: "d", name: "Doing" },
    { id: "e", name: "Empty" },
  ];
  const items = [
    { title: "a", done: false, tags: [], columnId: "d" },
    { title: "b", done: true, tags: ["x"], columnId: "b" },
    { title: "c", done: false, tags: ["x"], columnId: null },
    { title: "d", done: false, tags: [], columnId: "gone" },
  ];
  assert.deepEqual(computeStats(items, columns), {
    total: 4,
    done: 1,
    open: 3,
    tags: 1,
    columns: [
      { id: "b", name: "Backlog", count: 1 },
      { id: "d", name: "Doing", count: 1 },
      { id: "e", name: "Empty", count: 0 },
    ],
    unassigned: 2,
  });
});

test("GET /stats counts cards per column, with unassigned and dangling cards", async () => {
  const { file } = await tmpFile();
  const store = createStore({ path: file });
  const backlog = await store.createColumn({ name: "Backlog" });
  const doing = await store.createColumn({ name: "Doing" });
  await store.create({ title: "in doing", columnId: doing.id });
  await store.create({ title: "in backlog", columnId: backlog.id });
  await store.create({ title: "no column" });
  // The store refuses a columnId naming no column, so write the dangling card directly.
  const data = JSON.parse(await fs.readFile(file, "utf8"));
  data.items.push({ id: "ghost", title: "dangling", done: false, tags: [], columnId: "no-such-column" });
  await fs.writeFile(file, JSON.stringify(data));
  await withServer(file, async (base) => {
    const res = await fetch(base + "/stats");
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.columns, [
      { id: backlog.id, name: "Backlog", count: 1 },
      { id: doing.id, name: "Doing", count: 1 },
    ]);
    assert.equal(body.unassigned, 2);
    assert.equal(body.total, 4);
  });
});

test("GET /stats over a corrupt store answers 500", async () => {
  const { file } = await tmpFile();
  await fs.writeFile(file, "not json");
  await withServer(file, async (base) => {
    assert.equal((await fetch(base + "/stats")).status, 500);
  });
});

test("stats prints the counts as text", async () => {
  const { file } = await seeded();
  const r = banny(file, "stats");
  assert.equal(r.status, 0);
  assert.equal(r.stdout, "total: 3\ndone: 2\nopen: 1\ntags: 2\nunassigned: 3\n");
});

test("stats prints a column line per column in board order, then unassigned", async () => {
  const { file } = await tmpFile();
  const store = createStore({ path: file });
  await store.createColumn({ name: "Backlog" });
  const doing = await store.createColumn({ name: "Doing" });
  await store.create({ title: "in doing", done: false, tags: [], columnId: doing.id });
  await store.create({ title: "loose", done: false, tags: [] });
  await store.create({ title: "also loose", done: false, tags: [] });
  const r = banny(file, "stats");
  assert.equal(r.status, 0);
  assert.equal(
    r.stdout,
    "total: 3\ndone: 0\nopen: 3\ntags: 0\ncolumn Backlog: 0\ncolumn Doing: 1\nunassigned: 2\n",
  );
});

test("stats --json prints one compact line equal to GET /stats", async () => {
  const { file } = await seeded();
  const r = banny(file, "stats", "--json");
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trimEnd().split("\n").length, 1);
  assert.deepEqual(JSON.parse(r.stdout), SEEDED_STATS);
  await withServer(file, async (base) => {
    assert.deepEqual(await (await fetch(base + "/stats")).json(), JSON.parse(r.stdout));
  });
});

test("stats with an extra argument is a usage error", async () => {
  const { file } = await seeded();
  const r = banny(file, "stats", "extra");
  assert.equal(r.status, 2);
  assert.equal(r.stdout, "");
});

test("stats on a corrupt store exits 1 with empty stdout", async () => {
  const { file } = await tmpFile();
  await fs.writeFile(file, "not json");
  const r = banny(file, "stats");
  assert.equal(r.status, 1);
  assert.equal(r.stdout, "");
});

test("stats --json on a corrupt store prints the error shape on stderr", async () => {
  const { file } = await tmpFile();
  await fs.writeFile(file, "not json");
  const r = banny(file, "stats", "--json");
  assert.equal(r.status, 1);
  assert.equal(r.stdout, "");
  const body = JSON.parse(r.stderr);
  assert.equal(body.error.code, "store-corrupt");
  assert.equal(typeof body.error.message, "string");
});
