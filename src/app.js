import express from "express";
import healthRouter from "./routes/health.js";

export function createApp({ store } = {}) {
  const app = express();
  app.use(healthRouter(store));
  return app;
}
