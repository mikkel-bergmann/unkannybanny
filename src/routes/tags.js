import express from "express";

const TAG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

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
      return res.status(400).json({ error: "invalid-tag", message: "tag names must be lowercase tag names" });
    }
    store
      .renameTag(from, to)
      .then((renamed) =>
        renamed === 0
          ? res.status(404).json({ error: "not-found", message: `no item has the tag ${from}` })
          : res.json({ renamed }),
      )
      .catch(next);
  });
  return router;
}
