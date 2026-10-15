import express from "express";

export function serializeExport(items) {
  return JSON.stringify({ items }, null, 2) + "\n";
}

export default (store) => {
  const router = express.Router();
  router.get("/export", (req, res, next) =>
    Promise.resolve()
      .then(async () => {
        const items = await store.list();
        res.attachment("banny-export.json");
        res.type("application/json");
        res.send(serializeExport(items));
      })
      .catch(next),
  );
  return router;
};
