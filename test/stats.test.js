import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createStore } from "../src/store.js";
import { createApp } from "../src/app.js";

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

const SEEDED_STATS = { total: 3, done: 2, open: 1, tags: 2 };

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
    assert.deepEqual(await res.json(), { total: 0, done: 0, open: 0, tags: 0 });
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
  assert.equal(r.stdout, "total: 3\ndone: 2\nopen: 1\ntags: 2\n");
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
