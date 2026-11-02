import express from "express";

export function computeStats(items, columns = []) {
  const done = items.filter((i) => i.done).length;
  const tags = new Set(items.flatMap((i) => i.tags));
  const counts = new Map(columns.map((c) => [c.id, 0]));
  let unassigned = 0;
  for (const item of items) {
    if (counts.has(item.columnId)) counts.set(item.columnId, counts.get(item.columnId) + 1);
    else unassigned += 1;
  }
  return {
    total: items.length,
    done,
    open: items.length - done,
    tags: tags.size,
    columns: columns.map((c) => ({ id: c.id, name: c.name, count: counts.get(c.id) })),
    unassigned,
  };
}

// The share of cards that are done, as a whole percent. An empty board is 0% done.
export function computeProgress(items) {
  const done = items.filter((i) => i.done).length;
  return { done, total: items.length, percent: Math.round((done / items.length) * 100) };
}

export default function statsRouter(store) {
  const router = express.Router();
  router.get("/stats", (req, res, next) =>
    Promise.all([store.list(), store.listColumns()])
      .then(([items, columns]) => res.json(computeStats(items, columns)))
      .catch(next),
  );
  router.get("/stats/progress", (req, res, next) =>
    store
      .list()
      .then((items) => res.json(computeProgress(items)))
      .catch(next),
  );
  return router;
}
