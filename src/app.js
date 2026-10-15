import express from "express";
import healthRouter from "./routes/health.js";
import { requestLogger, noRoute, errorHandler } from "./log.js";

export function createApp({ store } = {}) {
  const app = express();
  app.use(requestLogger());
  app.use(healthRouter(store));
  app.use(noRoute);
  app.use(errorHandler);
  return app;
}
