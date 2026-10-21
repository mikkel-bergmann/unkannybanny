import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createStore } from "../src/store.js";
import { createApp } from "../src/app.js";

async function seeded() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "banny-rename-"));
  const file = path.join(dir, "banny.json");
  const store = createStore({ path: file });
  await store.create({ title: "milk", done: false, tags: ["shop", "kitchen"] });
  await store.create({ title: "bread", done: true, tags: ["shop"] });
  await store.create({ title: "plant", done: false, tags: ["garden"] });
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

test("renameTag renames the tag on every item that has it", async (t) => {
  const { dir, store } = await seeded();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  assert.equal(await store.renameTag("shop", "groceries"), 2);
  const items = await store.list();
  assert.deepEqual(items.map((i) => i.tags), [["groceries", "kitchen"], ["groceries"], ["garden"]]);
});

test("renameTag returns 0 and writes nothing for an unknown tag", async (t) => {
  const { dir, store } = await seeded();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const before = await store.list();
  assert.equal(await store.renameTag("nope", "other"), 0);
  assert.deepEqual(await store.list(), before);
});

test("POST /tags/:tag/rename renames and reports the count", async (t) => {
  const { dir, file } = await seeded();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  await withServer(file, async (base) => {
    const res = await fetch(`${base}/tags/shop/rename`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ to: "groceries" }),
    });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { renamed: 2 });
    const tags = await (await fetch(`${base}/tags`)).json();
    assert.deepEqual(tags.tags.map((x) => x.tag), ["garden", "groceries", "kitchen"]);
  });
});

test("POST /tags/:tag/rename rejects a bad name and 404s an unknown tag", async (t) => {
  const { dir, file } = await seeded();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  await withServer(file, async (base) => {
    const post = (tag, body) =>
      fetch(`${base}/tags/${tag}/rename`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    assert.equal((await post("shop", { to: "Bad Name" })).status, 400);
    assert.equal((await post("shop", {})).status, 400);
    assert.equal((await post("nope", { to: "other" })).status, 404);
  });
});
