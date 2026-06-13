import { Router } from "express";
import { detectAnomalies } from "../services/anomalyService.js";
import { optionalUser } from "../middleware/auth.js";

const router = Router();

/**
 * GET /anomalies?from&to
 * Detects rule-based anomalies. Open to all users; non-admins receive sanitized
 * metrics (no individual email/salary data in Rule D results).
 */
router.get("/", optionalUser, async (req, res) => {
  const { from, to } = req.query;
  try {
    const result = await detectAnomalies({
      from,
      to,
      isAdmin: Boolean(req.user?.isAdmin),
    });
    res.json(result);
  } catch (err) {
    console.error("[anomalies] error:", err.message);
    res.status(500).json({ error: "Anomaly detection failed.", detail: err.message });
  }
});

export default router;
