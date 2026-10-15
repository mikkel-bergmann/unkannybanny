import express from "express";
import healthRouter from "./routes/health.js";
import itemsRouter from "./routes/items.js";

export function createApp({ store } = {}) {
  const app = express();
  app.use(healthRouter(store));
  app.use(itemsRouter(store));
  return app;
}
