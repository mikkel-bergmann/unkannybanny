import { Router } from "express";

export default function healthRouter(store) {
  const router = Router();
  router.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
  });
  return router;
}
