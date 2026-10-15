import { test, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createApp } from "../src/app.js";
import { requestLogger, noRoute, errorHandler } from "../src/log.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const servers = [];

after(async () => {
  await Promise.all(servers.map((s) => new Promise((r) => s.close(r))));
});

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => {
      servers.push(server);
      resolve(`http://127.0.0.1:${server.address().port}`);
    });
  });
}

async function helper() {
  const lines = [];
  const app = express();
  app.use(requestLogger({ write: (l) => lines.push(l) }));
  app.get("/health", (req, res) => res.json({ status: "ok" }));
  app.get("/boom", () => {
    throw new Error("boom");
  });
  app.get("/secret", () => {
    throw new Error("secret detail");
  });
  app.get("/badbody", (req, res, next) =>
    next(Object.assign(new Error("bad body"), { status: 400, code: "invalid-json" })),
  );
  app.get("/corrupt", (req, res, next) =>
    next(Object.assign(new Error("x"), { code: "store-corrupt" })),
  );
  app.use(noRoute);
  app.use(errorHandler);
  return { base: await listen(app), lines };
}

async function waitFor(lines, n = 1) {
  for (let i = 0; i < 200 && lines.length < n; i++) {
    await new Promise((r) => setTimeout(r, 10));
  }
}

test("logs exactly one JSON line per request", async () => {
  const { base, lines } = await helper();
  const res = await fetch(`${base}/health?x=1`);
  await res.text();
  await waitFor(lines);
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(lines.length, 1);
  const entry = JSON.parse(lines[0]);
  assert.deepEqual(Object.keys(entry), ["time", "id", "method", "path", "status", "ms"]);
  assert.equal(entry.method, "GET");
  assert.equal(entry.path, "/health?x=1");
  assert.equal(entry.status, 200);
  assert.equal(typeof entry.time, "string");
  assert.equal(entry.id, res.headers.get("x-request-id"));
  assert.ok(Number.isInteger(entry.ms) && entry.ms >= 0);
  assert.ok(!("error" in entry));
});

test("a failed request logs the error message", async () => {
  const { base, lines } = await helper();
  const res = await fetch(`${base}/boom`);
  await res.text();
  await waitFor(lines);
  assert.equal(lines.length, 1);
  const entry = JSON.parse(lines[0]);
  assert.equal(entry.status, 500);
  assert.equal(entry.error, "boom");
});

test("generated request ids are distinct v4 UUIDs", async () => {
  const { base } = await helper();
  const a = await fetch(`${base}/health`);
  const b = await fetch(`${base}/health`);
  const ia = a.headers.get("x-request-id");
  const ib = b.headers.get("x-request-id");
  assert.match(ia, UUID);
  assert.match(ib, UUID);
  assert.notEqual(ia, ib);
});

test("a valid client request id is echoed", async () => {
  const { base } = await helper();
  const res = await fetch(`${base}/health`, { headers: { "X-Request-Id": "abc-123" } });
  assert.equal(res.headers.get("x-request-id"), "abc-123");
});

test("an invalid client request id is replaced", async () => {
  const { base } = await helper();
  for (const bad of ["a".repeat(129), "has space"]) {
    const res = await fetch(`${base}/health`, { headers: { "X-Request-Id": bad } });
    assert.match(res.headers.get("x-request-id"), UUID);
  }
});

test("a thrown error is a 500 internal", async () => {
  const { base } = await helper();
  const res = await fetch(`${base}/secret`);
  const text = await res.text();
  assert.equal(res.status, 500);
  assert.deepEqual(JSON.parse(text), {
    error: { code: "internal", message: "Internal server error" },
  });
  assert.ok(!text.includes("secret detail"));
});

test("a coded client error passes through", async () => {
  const { base } = await helper();
  const res = await fetch(`${base}/badbody`);
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), {
    error: { code: "invalid-json", message: "bad body" },
  });
});

test("a coded error without a client status stays internal", async () => {
  const { base } = await helper();
  const res = await fetch(`${base}/corrupt`);
  assert.equal(res.status, 500);
  assert.equal((await res.json()).error.code, "internal");
});

test("an unknown path is a JSON 404 from createApp", async () => {
  const base = await listen(createApp({}));
  const res = await fetch(`${base}/nope?x=1`);
  assert.equal(res.status, 404);
  assert.ok(res.headers.get("content-type").startsWith("application/json"));
  assert.deepEqual(await res.json(), {
    error: { code: "no-route", message: "No route for GET /nope" },
  });
  assert.ok(res.headers.get("x-request-id"));
});

test("createApp mounts noRoute and errorHandler last", async () => {
  const app = createApp({});
  const stack = app._router.stack;
  assert.equal(stack.at(-1).handle, errorHandler);
  assert.equal(stack.at(-2).handle, noRoute);
  const base = await listen(app);
  const res = await fetch(`${base}/health`);
  assert.ok(res.headers.get("x-request-id"));
});
