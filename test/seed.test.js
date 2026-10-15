import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const BIN = fileURLToPath(new URL("../bin/banny.js", import.meta.url));

function banny(dataFile, ...args) {
  return spawnSync(process.execPath, [BIN, ...args], {
    env: { ...process.env, BANNY_DATA: dataFile },
    encoding: "utf8",
  });
}

async function tmpFile() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "banny-seed-"));
  return { dir, file: path.join(dir, "banny.json") };
}

const TITLES = [
  "Peel the bananas",
  "Buy more bananas",
  "Water the banana plant",
  "Write the board README",
  "Plan the banana bread bake-off",
];

test("verb table holds six verbs in order and runs none on import", async () => {
  const { commands } = await import("../bin/banny.js");
  assert.deepEqual(Object.keys(commands), ["list", "add", "done", "remove", "seed", "export"]);
});

test("--help lists all six verbs", async () => {
  const { file } = await tmpFile();
  const r = banny(file, "--help");
  assert.equal(r.status, 0);
  for (const verb of ["list", "add", "done", "remove", "seed", "export"]) {
    assert.match(r.stdout, new RegExp(verb));
  }
});

test("seed on a missing file creates the five sample items", async () => {
  const { file } = await tmpFile();
  const r = banny(file, "seed");
  assert.equal(r.status, 0);
  const lines = r.stdout.trimEnd().split("\n");
  assert.equal(lines.length, 5);
  assert.match(lines[0], /\[ \] Peel the bananas {2}#kitchen$/);
  assert.match(lines[1], /\[ \] Buy more bananas {2}#shop #kitchen$/);
  assert.match(lines[2], /\[ \] Water the banana plant {2}#garden$/);
  assert.match(lines[3], /\[x\] Write the board README {2}#docs$/);
  assert.match(lines[4], /\[ \] Plan the banana bread bake-off$/);
  const data = JSON.parse(await fs.readFile(file, "utf8"));
  assert.deepEqual(data.items.map((i) => i.title), TITLES);
});

test("seed is safe to rerun", async () => {
  const { file } = await tmpFile();
  banny(file, "seed");
  const r = banny(file, "seed");
  assert.equal(r.status, 0);
  assert.equal(r.stdout, "store is not empty; nothing seeded\n");
  const data = JSON.parse(await fs.readFile(file, "utf8"));
  assert.equal(data.items.length, 5);
});

test("seed --json prints items, then an empty list on rerun", async () => {
  const { file } = await tmpFile();
  const first = banny(file, "seed", "--json");
  assert.equal(first.status, 0);
  assert.deepEqual(JSON.parse(first.stdout).items.map((i) => i.title), TITLES);
  const second = banny(file, "seed", "--json");
  assert.equal(second.status, 0);
  assert.deepEqual(JSON.parse(second.stdout), { items: [] });
});

test("seed with an extra argument is a usage error", async () => {
  const { file } = await tmpFile();
  const r = banny(file, "seed", "extra");
  assert.equal(r.status, 2);
  assert.equal(r.stdout, "");
  await assert.rejects(fs.access(file));
});

test("seed on a corrupt store exits 1 and leaves the file", async () => {
  const { file } = await tmpFile();
  await fs.writeFile(file, "not json");
  const r = banny(file, "seed", "--json");
  assert.equal(r.status, 1);
  assert.equal(JSON.parse(r.stderr).error.code, "store-corrupt");
  assert.equal(await fs.readFile(file, "utf8"), "not json");
});
