import express from "express";

export function serializeExport(items, columns = []) {
  const state = columns.length > 0 ? { items, columns } : { items };
  return JSON.stringify(state, null, 2) + "\n";
}

export default (store) => {
  const router = express.Router();
  router.get("/export", (req, res, next) =>
    Promise.resolve()
      .then(async () => {
        const items = await store.list();
        const columns = await store.listColumns();
        res.attachment("banny-export.json");
        res.type("application/json");
        res.send(serializeExport(items, columns));
      })
      .catch(next),
  );
  return router;
};
