import express from "express";

export function computeStats(items) {
  const done = items.filter((i) => i.done).length;
  const tags = new Set(items.flatMap((i) => i.tags));
  return { total: items.length, done, open: items.length - done, tags: tags.size };
}

export default function statsRouter(store) {
  const router = express.Router();
  router.get("/stats", (req, res, next) =>
    store.list().then((items) => res.json(computeStats(items))).catch(next),
  );
  return router;
}
