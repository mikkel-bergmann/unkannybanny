import fs from "node:fs/promises";
import crypto from "node:crypto";
import nodePath from "node:path";

export function createStore({ path } = {}) {
  const file = nodePath.resolve(path ?? process.env.BANNY_DATA ?? "data/banny.json");
  let items = [];
  let loadedStat = null;
  let queue = Promise.resolve();

  async function refresh() {
    let st;
    try {
      st = await fs.stat(file);
    } catch (err) {
      if (err.code === "ENOENT") {
        items = [];
        loadedStat = null;
        return;
      }
      throw err;
    }
    if (loadedStat && loadedStat.mtimeMs === st.mtimeMs && loadedStat.size === st.size) return;
    const text = await fs.readFile(file, "utf8");
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = undefined;
    }
    if (!Array.isArray(data?.items)) {
      const err = new Error(`store-corrupt: ${file} is not a {"items": [...]} JSON file`);
      err.code = "store-corrupt";
      throw err;
    }
    items = data.items;
    loadedStat = { mtimeMs: st.mtimeMs, size: st.size };
  }

  function run(op) {
    const result = queue.then(async () => {
      await refresh();
      return op();
    });
    queue = result.catch(() => {});
    return result;
  }

  async function persist() {
    await fs.mkdir(nodePath.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
    try {
      await fs.writeFile(tmp, JSON.stringify({ items }, null, 2) + "\n");
      const st = await fs.stat(tmp);
      await fs.rename(tmp, file);
      loadedStat = { mtimeMs: st.mtimeMs, size: st.size };
    } catch (err) {
      await fs.rm(tmp, { force: true });
      throw err;
    }
  }

  async function commit(next) {
    const previous = items;
    items = next;
    try {
      await persist();
    } catch (err) {
      items = previous;
      throw err;
    }
  }

  return {
    path: file,
    list: () => run(() => structuredClone(items)),
    get: (id) =>
      run(() => {
        const found = items.find((i) => i.id === id);
        return found ? structuredClone(found) : null;
      }),
    create: ({ title, done, tags } = {}) =>
      run(async () => {
        const now = new Date().toISOString();
        const item = { id: crypto.randomUUID(), title, done, tags, createdAt: now, updatedAt: now };
        await commit([...items, item]);
        return structuredClone(item);
      }),
    update: (id, patch = {}) =>
      run(async () => {
        const index = items.findIndex((i) => i.id === id);
        if (index === -1) return null;
        const next = { ...items[index] };
        for (const key of ["title", "done", "tags"]) {
          if (key in patch) next[key] = patch[key];
        }
        next.updatedAt = new Date().toISOString();
        const copy = [...items];
        copy[index] = next;
        await commit(copy);
        return structuredClone(next);
      }),
    remove: (id) =>
      run(async () => {
        if (!items.some((i) => i.id === id)) return false;
        await commit(items.filter((i) => i.id !== id));
        return true;
      }),
  };
}
