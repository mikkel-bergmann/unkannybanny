import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";
import { startServer } from "../src/server.js";

const servers = [];

function listen(app) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1");
    servers.push(server);
    server.once("listening", () => resolve(server));
    server.once("error", reject);
  });
}

after(async () => {
  await Promise.all(
    servers.map(
      (server) => new Promise((resolve) => server.close(() => resolve())),
    ),
  );
});

test("GET /health answers 200 with a fixed JSON body", async () => {
  const server = await listen(createApp({}));
  const res = await fetch(`http://127.0.0.1:${server.address().port}/health`);
  assert.equal(res.status, 200);
  assert.ok(
    res.headers.get("content-type").startsWith("application/json; charset=utf-8"),
  );
  assert.deepEqual(await res.json(), { status: "ok" });
});

test("createApp builds independent apps", async () => {
  const a = await listen(createApp({}));
  const b = await listen(createApp({}));
  for (const server of [a, b]) {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/health`);
    assert.equal(res.status, 200);
  }
});

test("startServer binds to loopback only and serves /health", async () => {
  const server = await startServer({ port: 0 });
  servers.push(server);
  assert.equal(server.address().address, "127.0.0.1");
  const res = await fetch(`http://127.0.0.1:${server.address().port}/health`);
  assert.equal(res.status, 200);
});
