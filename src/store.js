import fs from "node:fs/promises";
import crypto from "node:crypto";
import nodePath from "node:path";
import { ItemValidationError } from "./items.js";

export function createStore({ path } = {}) {
  const file = nodePath.resolve(path ?? process.env.BANNY_DATA ?? "data/banny.json");
  let items = [];
  let columns = [];
  let loadedStat = null;
  let queue = Promise.resolve();

  async function refresh() {
    let st;
    try {
      st = await fs.stat(file);
    } catch (err) {
      if (err.code === "ENOENT") {
        items = [];
        columns = [];
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
    columns = Array.isArray(data.columns) ? data.columns : [];
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
    const state = columns.length > 0 ? { items, columns } : { items };
    try {
      await fs.writeFile(tmp, JSON.stringify(state, null, 2) + "\n");
      const st = await fs.stat(tmp);
      await fs.rename(tmp, file);
      loadedStat = { mtimeMs: st.mtimeMs, size: st.size };
    } catch (err) {
      await fs.rm(tmp, { force: true });
      throw err;
    }
  }

  async function commit(nextItems, nextColumns = columns) {
    const previousItems = items;
    const previousColumns = columns;
    items = nextItems;
    columns = nextColumns;
    try {
      await persist();
    } catch (err) {
      items = previousItems;
      columns = previousColumns;
      throw err;
    }
  }

  function checkColumn(columnId) {
    if (columnId != null && !columns.some((c) => c.id === columnId)) {
      throw new ItemValidationError(`columnId names no column: ${columnId}`);
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
    create: ({ title, done, tags, columnId } = {}) =>
      run(async () => {
        checkColumn(columnId);
        const now = new Date().toISOString();
        const item = {
          id: crypto.randomUUID(),
          title,
          done,
          tags,
          columnId: columnId ?? null,
          createdAt: now,
          updatedAt: now,
        };
        await commit([...items, item]);
        return structuredClone(item);
      }),
    update: (id, patch = {}) =>
      run(async () => {
        const index = items.findIndex((i) => i.id === id);
        if (index === -1) return null;
        if ("columnId" in patch) checkColumn(patch.columnId);
        const next = { ...items[index] };
        for (const key of ["title", "done", "tags", "columnId"]) {
          if (key in patch) next[key] = patch[key];
        }
        next.updatedAt = new Date().toISOString();
        const copy = [...items];
        copy[index] = next;
        await commit(copy);
        return structuredClone(next);
      }),
    moveItem: (id, { columnId, before } = {}) =>
      run(async () => {
        const index = items.findIndex((i) => i.id === id);
        if (index === -1) return null;
        checkColumn(columnId);
        const next = { ...items[index], columnId: columnId ?? null, updatedAt: new Date().toISOString() };
        const rest = items.filter((i) => i.id !== id);
        const at = before == null ? -1 : rest.findIndex((i) => i.id === before);
        if (at === -1) rest.push(next);
        else rest.splice(at, 0, next);
        await commit(rest);
        return structuredClone(next);
      }),
    remove: (id) =>
      run(async () => {
        if (!items.some((i) => i.id === id)) return false;
        await commit(items.filter((i) => i.id !== id));
        return true;
      }),
    listColumns: () => run(() => structuredClone(columns)),
    getColumn: (id) =>
      run(() => {
        const found = columns.find((c) => c.id === id);
        return found ? structuredClone(found) : null;
      }),
    createColumn: ({ name } = {}) =>
      run(async () => {
        const now = new Date().toISOString();
        const column = { id: crypto.randomUUID(), name, createdAt: now, updatedAt: now };
        await commit(items, [...columns, column]);
        return structuredClone(column);
      }),
    updateColumn: (id, patch = {}) =>
      run(async () => {
        const index = columns.findIndex((c) => c.id === id);
        if (index === -1) return null;
        const next = { ...columns[index] };
        if ("name" in patch) next.name = patch.name;
        next.updatedAt = new Date().toISOString();
        const copy = [...columns];
        copy[index] = next;
        await commit(items, copy);
        return structuredClone(next);
      }),
    removeColumn: (id) =>
      run(async () => {
        if (!columns.some((c) => c.id === id)) return false;
        const nextColumns = columns.filter((c) => c.id !== id);
        const nextItems = items.map((i) => (i.columnId === id ? { ...i, columnId: null } : i));
        await commit(nextItems, nextColumns);
        return true;
      }),
    reorderColumns: (ids) =>
      run(async () => {
        if (!Array.isArray(ids) || ids.length !== columns.length) return null;
        const byId = new Map(columns.map((c) => [c.id, c]));
        const seen = new Set();
        const ordered = [];
        for (const id of ids) {
          if (typeof id !== "string" || !byId.has(id) || seen.has(id)) return null;
          seen.add(id);
          ordered.push(byId.get(id));
        }
        await commit(items, ordered);
        return structuredClone(ordered);
      }),
  };
}
