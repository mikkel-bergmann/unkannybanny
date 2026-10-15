import express from "express";
import healthRouter from "./routes/health.js";
import itemsRouter from "./routes/items.js";
import tagsRouter from "./routes/tags.js";
import exportRouter from "./routes/export.js";
import { requestLogger, noRoute, errorHandler } from "./log.js";

export function createApp({ store } = {}) {
  const app = express();
  app.use(requestLogger());
  app.use(healthRouter(store));
  app.use(itemsRouter(store));
  app.use(tagsRouter(store));
  app.use(exportRouter(store));
  app.use(noRoute);
  app.use(errorHandler);
  return app;
}
