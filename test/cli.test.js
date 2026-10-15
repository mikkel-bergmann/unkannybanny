import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createStore } from "../src/store.js";

const BIN = fileURLToPath(new URL("../bin/banny.js", import.meta.url));

function banny(dataFile, ...args) {
  return spawnSync(process.execPath, [BIN, ...args], {
    env: { ...process.env, BANNY_DATA: dataFile },
    encoding: "utf8",
  });
}

async function tmpFile() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "banny-cli-"));
  return { dir, file: path.join(dir, "banny.json") };
}

test("--help lists the verbs and exits 0", async () => {
  const { file } = await tmpFile();
  const r = banny(file, "--help");
  assert.equal(r.status, 0);
  for (const verb of ["list", "add", "done", "remove"]) assert.match(r.stdout, new RegExp(verb));
});

test("usage errors exit 2 with empty stdout", async () => {
  const { file } = await tmpFile();
  for (const args of [[], ["frobnicate"], ["list", "--nope"], ["add", "--tag"], ["list", "extra"]]) {
    const r = banny(file, ...args);
    assert.equal(r.status, 2, args.join(" "));
    assert.equal(r.stdout, "");
    assert.notEqual(r.stderr, "");
  }
});

test("importing the module exposes commands and runs nothing", async () => {
  const { commands } = await import("../bin/banny.js");
  assert.deepEqual(Object.keys(commands).slice(0, 4), ["list", "add", "done", "remove"]);
});

test("importing the module tolerates an argv[1] that is not a file", async () => {
  const { dir } = await tmpFile();
  const code = `import(${JSON.stringify(pathToFileURL(BIN).href)}).then((m) => console.log(Object.keys(m.commands)[0]))`;
  const r = spawnSync(process.execPath, ["-e", code, "no-such-file"], { cwd: dir, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, "list\n");
});

test("entry guard holds through a symlink", async () => {
  const { dir, file } = await tmpFile();
  const item = await createStore({ path: file }).create({ title: "milk", done: false, tags: [] });
  const link = path.join(dir, "banny");
  await fs.symlink(BIN, link);
  const r = spawnSync(process.execPath, [link, "list"], {
    env: { ...process.env, BANNY_DATA: file },
    encoding: "utf8",
  });
  assert.equal(r.status, 0);
  assert.ok(r.stdout.includes(item.id));
});

test("list shows items and done marks", async () => {
  const { file } = await tmpFile();
  const store = createStore({ path: file });
  const a = await store.create({ title: "milk", done: false, tags: ["shop"] });
  const b = await store.create({ title: "bread", done: true, tags: [] });
  const r = banny(file, "list");
  assert.equal(r.status, 0);
  assert.equal(r.stdout, `${a.id}  [ ] milk  #shop\n${b.id}  [x] bread\n`);
});

test("list on a missing file prints nothing and creates nothing", async () => {
  const { file } = await tmpFile();
  const r = banny(file, "list");
  assert.equal(r.status, 0);
  assert.equal(r.stdout, "");
  await assert.rejects(fs.stat(file));
});

test("add creates an item with tags", async () => {
  const { file } = await tmpFile();
  const r = banny(file, "add", "buy", "milk", "--tag", "shop", "--tag", "home");
  assert.equal(r.status, 0);
  const { items } = JSON.parse(await fs.readFile(file, "utf8"));
  assert.equal(items.length, 1);
  assert.equal(items[0].done, false);
  assert.deepEqual(items[0].tags, ["shop", "home"]);
  assert.equal(r.stdout, `${items[0].id}  [ ] buy milk  #shop #home\n`);
});

test("add refuses invalid items and leaves the file unchanged", async () => {
  const { file } = await tmpFile();
  await createStore({ path: file }).create({ title: "x", done: false, tags: [] });
  const before = await fs.readFile(file);
  for (const args of [["add", "milk", "--tag", "Bad Tag"], ["add", "a".repeat(201)]]) {
    const r = banny(file, ...args);
    assert.equal(r.status, 3);
    assert.equal(r.stdout, "");
    assert.deepEqual(await fs.readFile(file), before);
  }
});

test("words after -- are title words, not flags", async () => {
  const { file } = await tmpFile();
  const h = banny(file, "add", "--", "-h", "is", "a", "flag");
  assert.equal(h.status, 0);
  const j = banny(file, "add", "--", "--json");
  assert.equal(j.status, 0);
  const { items } = JSON.parse(await fs.readFile(file, "utf8"));
  assert.deepEqual(items.map((i) => i.title), ["-h is a flag", "--json"]);
  assert.equal(h.stdout, `${items[0].id}  [ ] -h is a flag\n`);
  assert.equal(j.stdout, `${items[1].id}  [ ] --json\n`);
});

test("add without a title is a usage error", async () => {
  const { file } = await tmpFile();
  assert.equal(banny(file, "add", "--tag", "shop").status, 2);
});

test("done is idempotent and --undo reopens", async () => {
  const { file } = await tmpFile();
  const item = await createStore({ path: file }).create({ title: "milk", done: false, tags: [] });
  for (let i = 0; i < 2; i++) {
    const r = banny(file, "done", item.id);
    assert.equal(r.status, 0);
    assert.equal(r.stdout, `${item.id}  [x] milk\n`);
  }
  const u = banny(file, "done", item.id, "--undo");
  assert.equal(u.status, 0);
  assert.equal(u.stdout, `${item.id}  [ ] milk\n`);
  assert.equal(JSON.parse(await fs.readFile(file, "utf8")).items[0].done, false);
});

test("done with an unknown or partial id exits 4", async () => {
  const { file } = await tmpFile();
  const item = await createStore({ path: file }).create({ title: "milk", done: false, tags: [] });
  assert.equal(banny(file, "done", "no-such-id").status, 4);
  assert.equal(banny(file, "done", item.id.slice(0, 8)).status, 4);
});

test("remove deletes once then exits 4", async () => {
  const { file } = await tmpFile();
  const item = await createStore({ path: file }).create({ title: "milk", done: false, tags: [] });
  const r = banny(file, "remove", item.id);
  assert.equal(r.status, 0);
  assert.equal(r.stdout, `removed ${item.id}\n`);
  assert.deepEqual(JSON.parse(await fs.readFile(file, "utf8")).items, []);
  assert.equal(banny(file, "remove", item.id).status, 4);
});

test("done and remove need exactly one id", async () => {
  const { file } = await tmpFile();
  for (const verb of ["done", "remove"]) {
    assert.equal(banny(file, verb).status, 2);
    assert.equal(banny(file, verb, "a", "b").status, 2);
  }
});

test("--json success documents", async () => {
  const { file } = await tmpFile();
  const added = JSON.parse(banny(file, "add", "milk", "--json").stdout);
  assert.equal(added.title, "milk");
  assert.deepEqual(JSON.parse(banny(file, "list", "--json").stdout), { items: [added] });
  const done = JSON.parse(banny(file, "--json", "done", added.id).stdout);
  assert.equal(done.done, true);
  assert.deepEqual(JSON.parse(banny(file, "remove", added.id, "--json").stdout), {
    id: added.id,
    removed: true,
  });
});

test("--json errors go to stderr as documents", async () => {
  const { file } = await tmpFile();
  const nf = banny(file, "done", "no-such-id", "--json");
  assert.equal(nf.status, 4);
  assert.equal(nf.stdout, "");
  const e = JSON.parse(nf.stderr);
  assert.equal(e.error.code, "not-found");
  assert.equal(typeof e.error.message, "string");
  const u = banny(file, "frobnicate", "--json");
  assert.equal(u.status, 2);
  assert.equal(JSON.parse(u.stderr).error.code, "usage");
});

test("human errors are one line starting banny: ", async () => {
  const { file } = await tmpFile();
  const r = banny(file, "remove", "no-such-id");
  assert.equal(r.status, 4);
  assert.equal(r.stdout, "");
  assert.match(r.stderr, /^banny: [^\n]*\n$/);
});

test("a corrupt store exits 1 and is left alone", async () => {
  const { file } = await tmpFile();
  await fs.writeFile(file, "not json");
  const r = banny(file, "list", "--json");
  assert.equal(r.status, 1);
  assert.equal(JSON.parse(r.stderr).error.code, "store-corrupt");
  assert.equal(await fs.readFile(file, "utf8"), "not json");
});
