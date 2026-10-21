import express from "express";

const TAG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function sendError(res, status, code, message) {
  res.status(status).json({ error: { code, message } });
}

export class InvalidQueryError extends Error {
  constructor(message) {
    super(message);
    this.name = "InvalidQueryError";
    this.code = "invalid-query";
    this.status = 400;
  }
}

export function filterItems(items, query) {
  const raw = query.tag;
  const tags = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];
  for (const t of tags) {
    if (typeof t !== "string" || !TAG_RE.test(t)) {
      throw new InvalidQueryError("tag must be a lowercase tag name");
    }
  }
  if (query.q !== undefined && typeof query.q !== "string") {
    throw new InvalidQueryError("q must be a single string");
  }
  const needle = (query.q ?? "").trim().toLowerCase();
  return items.filter(
    (item) =>
      tags.every((t) => item.tags.includes(t)) &&
      (needle === "" || item.title.toLowerCase().includes(needle)),
  );
}

export function countTags(items) {
  const map = new Map();
  for (const item of items) {
    for (const tag of item.tags) map.set(tag, (map.get(tag) ?? 0) + 1);
  }
  return [...map]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0));
}

export default function tagsRouter(store) {
  const router = express.Router();
  router.get("/tags", (req, res, next) =>
    store.list().then((items) => res.json({ tags: countTags(items) })).catch(next),
  );
  router.post("/tags/:tag/rename", express.json(), (req, res, next) => {
    const from = req.params.tag;
    const to = req.body?.to;
    if (!TAG_RE.test(from) || typeof to !== "string" || !TAG_RE.test(to)) {
      return sendError(res, 400, "invalid-tag", "tag names must be lowercase tag names");
    }
    store
      .renameTag(from, to)
      .then((renamed) =>
        renamed === 0
          ? sendError(res, 404, "not-found", `no item has the tag ${from}`)
          : res.json({ renamed }),
      )
      .catch(next);
  });
  router.use((err, req, res, next) => {
    if (typeof err.type === "string" && err.status >= 400 && err.status <= 499) {
      return sendError(res, 400, "invalid-json", "request body is not valid JSON");
    }
    next(err);
  });
  return router;
}
