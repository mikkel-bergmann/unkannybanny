import express, { Router } from "express";
import { validateNewItem, validateItemPatch, ItemValidationError } from "../items.js";

function sendError(res, status, code, message) {
  res.status(status).json({ error: { code, message } });
}

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function requireJson(req, res, next) {
  if (!req.is("application/json")) {
    return sendError(res, 415, "unsupported-media-type", "request body must be application/json");
  }
  next();
}

export default function itemsRouter(store) {
  const router = Router();
  const notFound = (res, id) => sendError(res, 404, "not-found", `no item with id ${id}`);

  router.get("/items", wrap(async (req, res) => {
    res.json({ items: await store.list() });
  }));

  router.post("/items", requireJson, express.json(), wrap(async (req, res) => {
    const item = await store.create(validateNewItem(req.body));
    res.status(201).location("/items/" + item.id).json(item);
  }));

  router.get("/items/:id", wrap(async (req, res) => {
    const item = await store.get(req.params.id);
    if (!item) return notFound(res, req.params.id);
    res.json(item);
  }));

  router.patch("/items/:id", requireJson, express.json(), wrap(async (req, res) => {
    const item = await store.update(req.params.id, validateItemPatch(req.body));
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
    next(err);
  });

  return router;
}
