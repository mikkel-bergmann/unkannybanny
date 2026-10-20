import express, { Router } from "express";
import { filterItems, InvalidQueryError } from "./tags.js";
import { validateNewItem, validateItemPatch, validateItemMove, ItemValidationError } from "../items.js";

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

async function requireColumn(store, columnId) {
  if (columnId === null || columnId === undefined) return;
  if (!(await store.getColumn(columnId))) {
    throw new ItemValidationError(`columnId names no column: ${columnId}`);
  }
}

export default function itemsRouter(store) {
  const router = Router();
  const notFound = (res, id) => sendError(res, 404, "not-found", `no item with id ${id}`);

  router.get("/items", wrap(async (req, res) => {
    res.json({ items: filterItems(await store.list(), req.query) });
  }));

  router.post("/items", requireJson, express.json(), wrap(async (req, res) => {
    const input = validateNewItem(req.body);
    await requireColumn(store, input.columnId);
    const item = await store.create(input);
    res.status(201).location("/items/" + item.id).json(item);
  }));

  router.get("/items/:id", wrap(async (req, res) => {
    const item = await store.get(req.params.id);
    if (!item) return notFound(res, req.params.id);
    res.json(item);
  }));

  router.patch("/items/:id", requireJson, express.json(), wrap(async (req, res) => {
    const patch = validateItemPatch(req.body);
    if ("columnId" in patch) await requireColumn(store, patch.columnId);
    const item = await store.update(req.params.id, patch);
    if (!item) return notFound(res, req.params.id);
    res.json(item);
  }));

  router.post("/items/:id/move", requireJson, express.json(), wrap(async (req, res) => {
    const input = validateItemMove(req.body);
    await requireColumn(store, input.columnId);
    if (input.before !== null) {
      const target = await store.get(input.before);
      if (!target) throw new ItemValidationError(`before names no item: ${input.before}`);
      if (input.before === req.params.id) throw new ItemValidationError("before must not be the moved item");
      if (target.columnId !== input.columnId) {
        throw new ItemValidationError("before names an item in another column");
      }
    }
    const item = await store.moveItem(req.params.id, input);
    if (!item) return notFound(res, req.params.id);
    res.json(item);
  }));

  router.delete("/items/:id", wrap(async (req, res) => {
    const removed = await store.remove(req.params.id);
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
    if (err instanceof ItemValidationError) {
      return sendError(res, 400, "invalid-item", err.message);
    }
    if (err instanceof InvalidQueryError) {
      return sendError(res, 400, "invalid-query", err.message);
    }
    next(err);
  });

  return router;
}
