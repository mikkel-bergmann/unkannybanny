import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createStore } from "../src/store.js";
import { createApp } from "../src/app.js";
import { computeProgress } from "../src/routes/stats.js";

test("computeProgress rounds the done share to a whole percent", () => {
  const items = [{ done: true }, { done: true }, { done: false }];
  assert.deepEqual(computeProgress(items), { done: 2, total: 3, percent: 67 });
});

test("computeProgress is 100 when every card is done", () => {
  assert.equal(computeProgress([{ done: true }, { done: true }]).percent, 100);
});

test("computeProgress is 0 when no card is done", () => {
  assert.equal(computeProgress([{ done: false }]).percent, 0);
});

test("computeProgress is 0 on an empty board", () => {
  assert.deepEqual(computeProgress([]), { done: 0, total: 0, percent: 0 });
});

test("GET /stats/progress answers the seeded board's progress", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "banny-progress-"));
  const file = path.join(dir, "banny.json");
  const store = createStore({ path: file });
  await store.create({ title: "milk", done: false, tags: [] });
  await store.create({ title: "bread", done: true, tags: [] });
  await store.create({ title: "plant", done: true, tags: [] });
  const server = createApp({ store: createStore({ path: file }) }).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/stats/progress`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { done: 2, total: 3, percent: 67 });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
