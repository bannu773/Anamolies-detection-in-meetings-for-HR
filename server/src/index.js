import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectDB } from "./config/db.js";

import healthRoutes from "./routes/health.js";
import authRoutes from "./routes/auth.js";
import ingestRoutes from "./routes/ingest.js";
import attributionRoutes from "./routes/attribution.js";
import costRoutes from "./routes/cost.js";
import metaRoutes from "./routes/meta.js";
import anomalyRoutes from "./routes/anomaly.js";

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));

// --- Security headers (Phase 6) ---
// Applied before any route so every response gets them.
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});

app.use("/health", healthRoutes);
app.use("/auth/google", authRoutes);
app.use("/ingest", ingestRoutes);
app.use("/attribution", attributionRoutes);
app.use("/cost", costRoutes);
app.use("/meta", metaRoutes);
app.use("/anomalies", anomalyRoutes);

app.get("/", (_req, res) => res.json({ name: "HR Cost Intelligence Engine API", ok: true }));

// Centralized error fallback so a thrown error never leaks a stack to the client.
app.use((err, _req, res, _next) => {
  console.error("[unhandled]", err);
  res.status(500).json({ error: "Internal server error." });
});

const PORT = process.env.PORT || 8000;

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`[server] listening on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error("[boot] failed to start:", err.message);
    process.exit(1);
  });
