import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createStore } from "../src/store.js";
import { createApp } from "../src/app.js";
import { serializeExport } from "../src/routes/export.js";

const BIN = fileURLToPath(new URL("../bin/banny.js", import.meta.url));

function banny(dataFile, ...args) {
  return spawnSync(process.execPath, [BIN, ...args], {
    env: { ...process.env, BANNY_DATA: dataFile },
    encoding: "utf8",
  });
}

async function tmpFile() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "banny-export-"));
  return { dir, file: path.join(dir, "banny.json") };
}

async function seeded() {
  const { dir, file } = await tmpFile();
  const store = createStore({ path: file });
  await store.create({ title: "milk", done: false, tags: ["shop"] });
  await store.create({ title: "bread", done: true, tags: [] });
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

test("export prints the serialized store, equal to the data file", async () => {
  const { file, store } = await seeded();
  const r = banny(file, "export");
  assert.equal(r.status, 0);
  assert.equal(r.stdout, serializeExport(await store.list()));
  assert.equal(r.stdout, await fs.readFile(file, "utf8"));
});

test("export of a missing file prints an empty document and creates nothing", async () => {
  const { file } = await tmpFile();
  const r = banny(file, "export");
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '{\n  "items": []\n}\n');
  await assert.rejects(fs.access(file));
});

test("export --json prints one compact line", async () => {
  const { file, store } = await seeded();
  const r = banny(file, "export", "--json");
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trimEnd().split("\n").length, 1);
  assert.deepEqual(JSON.parse(r.stdout), { items: await store.list() });
});

test("export output loads as a data file", async () => {
  const { dir, file, store } = await seeded();
  const copy = path.join(dir, "copy.json");
  await fs.writeFile(copy, banny(file, "export").stdout);
  assert.deepEqual(await createStore({ path: copy }).list(), await store.list());
});

test("export with an extra argument is a usage error", async () => {
  const { file } = await seeded();
  const before = await fs.readFile(file, "utf8");
  const r = banny(file, "export", "extra");
  assert.equal(r.status, 2);
  assert.equal(r.stdout, "");
  assert.equal(await fs.readFile(file, "utf8"), before);
});

test("export on a corrupt store exits 1 with empty stdout", async () => {
  const { file } = await tmpFile();
  await fs.writeFile(file, "not json");
  const r = banny(file, "export");
  assert.equal(r.status, 1);
  assert.equal(r.stdout, "");
  assert.match(r.stderr, /^banny: /);
});

test("GET /export downloads the store and matches the CLI", async () => {
  const { file } = await seeded();
  await withServer(file, async (base) => {
    const res = await fetch(base + "/export");
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type"), /^application\/json; charset=utf-8/);
    assert.equal(res.headers.get("content-disposition"), 'attachment; filename="banny-export.json"');
    assert.equal(await res.text(), banny(file, "export").stdout);
  });
});

test("GET /export over a corrupt store answers 500", async () => {
  const { file } = await tmpFile();
  await fs.writeFile(file, "not json");
  await withServer(file, async (base) => {
    assert.equal((await fetch(base + "/export")).status, 500);
  });
  assert.equal(await fs.readFile(file, "utf8"), "not json");
});

test("export carries columns and reloads them", async () => {
  const { dir, file, store } = await seeded();
  await store.createColumn({ name: "Doing" });
  const r = banny(file, "export");
  assert.equal(r.status, 0);
  assert.equal(r.stdout, await fs.readFile(file, "utf8"));
  const copy = path.join(dir, "copy.json");
  await fs.writeFile(copy, r.stdout);
  const reloaded = createStore({ path: copy });
  assert.deepEqual(await reloaded.list(), await store.list());
  assert.deepEqual(
    (await reloaded.listColumns()).map((c) => c.name),
    ["Doing"],
  );
});

test("GET /export carries columns and matches the CLI", async () => {
  const { file, store } = await seeded();
  await store.createColumn({ name: "Doing" });
  await withServer(file, async (base) => {
    const res = await fetch(base + "/export");
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.equal(text, banny(file, "export").stdout);
    assert.deepEqual(JSON.parse(text).columns.map((c) => c.name), ["Doing"]);
  });
});
