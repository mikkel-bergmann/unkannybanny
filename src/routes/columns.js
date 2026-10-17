import express, { Router } from "express";
import { validateNewColumn, validateColumnPatch, ColumnValidationError } from "../columns.js";

function sendError(res, status, code, message) {
  res.status(status).json({ error: { code, message } });
}

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function requireJson(req, res, next) {
  if (!req.is("application/json") || req.get("content-length") === "0") {
    return sendError(res, 415, "unsupported-media-type", "request body must be application/json");
  }
  next();
}

export default function columnsRouter(store) {
  const router = Router();
  const notFound = (res, id) => sendError(res, 404, "not-found", `no column with id ${id}`);

  router.get("/columns", wrap(async (req, res) => {
    res.json({ columns: await store.listColumns() });
  }));

  router.post("/columns", requireJson, express.json(), wrap(async (req, res) => {
    const column = await store.createColumn(validateNewColumn(req.body));
    res.status(201).location("/columns/" + column.id).json(column);
  }));

  router.put("/columns/order", requireJson, express.json(), wrap(async (req, res) => {
    const ids = req.body?.ids;
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) {
      return sendError(res, 400, "invalid-column", "ids must be an array of column ids");
    }
    const columns = await store.reorderColumns(ids);
    if (columns === null) {
      return sendError(res, 400, "invalid-column", "ids must name every column exactly once");
    }
    res.json({ columns });
  }));

  router.patch("/columns/:id", requireJson, express.json(), wrap(async (req, res) => {
    const column = await store.updateColumn(req.params.id, validateColumnPatch(req.body));
    if (!column) return notFound(res, req.params.id);
    res.json(column);
  }));

  router.delete("/columns/:id", wrap(async (req, res) => {
    const removed = await store.removeColumn(req.params.id);
    if (!removed) return notFound(res, req.params.id);
    res.status(204).end();
  }));

  router.use((err, req, res, next) => {
    if (err.type === "entity.parse.failed") {
      return sendError(res, 400, "invalid-json", "request body is not valid JSON");
    }
    if (typeof err.type === "string" && err.status >= 400 && err.status <= 499) {
      return sendError(res, 400, "invalid-json", "request body could not be read as JSON");
    }
    if (err instanceof ColumnValidationError) {
      return sendError(res, 400, "invalid-column", err.message);
    }
    next(err);
  });

  return router;
}
