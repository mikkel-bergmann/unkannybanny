import express from "express";
import { fileURLToPath } from "node:url";
import healthRouter from "./routes/health.js";
import itemsRouter from "./routes/items.js";
import tagsRouter from "./routes/tags.js";
import exportRouter from "./routes/export.js";
import statsRouter from "./routes/stats.js";
import { requestLogger, noRoute, errorHandler } from "./log.js";

const publicDir = fileURLToPath(new URL("../public", import.meta.url));

export function createApp({ store } = {}) {
  const app = express();
  app.use(requestLogger());
  app.use(healthRouter(store));
  app.use(itemsRouter(store));
  app.use(tagsRouter(store));
  app.use(exportRouter(store));
  app.use(statsRouter(store));
  app.use(express.static(publicDir));
  app.use(noRoute);
  app.use(errorHandler);
  return app;
}
