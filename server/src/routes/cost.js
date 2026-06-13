import { Router } from "express";
import { aggregateByProject, costForMeeting } from "../services/costService.js";
import { requireAdmin } from "../middleware/auth.js";

const router = Router();

/**
 * GET /cost/projects?from&to&team&role
 * HR cost per project with by-team / by-role breakdowns and budget utilization.
 * k-anonymity is applied inside the service — small groups return null costs with
 * a `suppressed[]` list the UI uses to show a privacy notice.
 * Open to all authenticated users (no admin required — only project-level totals).
 */
router.get("/projects", async (req, res) => {
  const { from, to, team, role } = req.query;
  try {
    const result = await aggregateByProject({ from, to, team, role });
    res.json(result);
  } catch (err) {
    console.error("[cost/projects] error:", err.message);
    res.status(500).json({ error: "Cost aggregation failed.", detail: err.message });
  }
});

/**
 * GET /cost/meeting/:googleEventId — per-attendee cost breakdown for one meeting.
 * ADMIN ONLY: individual contributor costs derive each person's hourly rate (salary
 * data). Protected by JWT admin gate — returns 401/403 for non-admins.
 */
router.get("/meeting/:googleEventId", requireAdmin, async (req, res) => {
  try {
    const result = await costForMeeting(req.params.googleEventId);
    if (!result) return res.status(404).json({ error: "Meeting not found." });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
