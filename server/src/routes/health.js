import { Router } from "express";
import mongoose from "mongoose";

const router = Router();

/** GET /health — liveness + DB connection state. */
router.get("/", (_req, res) => {
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  res.json({
    status: "ok",
    time: new Date().toISOString(),
    db: states[mongoose.connection.readyState] || "unknown",
  });
});

export default router;
