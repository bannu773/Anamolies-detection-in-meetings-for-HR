import { Router } from "express";
import { runAttribution } from "../services/attributionService.js";
import { evaluateAttribution } from "../services/evalService.js";
import { warmup } from "../llm/replicateClient.js";
import { Meeting } from "../models/Meeting.js";
import { CONFIDENCE_THRESHOLD } from "../config/constants.js";

const router = Router();

/** POST /attribution/warmup — pay LLM cold-start before a demo. */
router.post("/warmup", async (_req, res) => {
  const ok = await warmup();
  res.json({ warmedUp: ok });
});

/**
 * POST /attribution/run
 * Body: { force?: bool, onlyUnattributed?: bool }
 * Attributes meetings via the LLM (cached, retried, threshold-flagged).
 */
router.post("/run", async (req, res) => {
  const { force = false, onlyUnattributed = true } = req.body || {};
  try {
    const result = await runAttribution({ force, onlyUnattributed });
    res.json(result);
  } catch (err) {
    console.error("[attribution/run] error:", err.message);
    res.status(500).json({ error: "Attribution failed.", detail: err.message });
  }
});

/** GET /attribution/eval — accuracy vs ground-truth labels (sample data). */
router.get("/eval", async (_req, res) => {
  try {
    res.json(await evaluateAttribution());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /attribution/review — the human review queue (low-confidence / unattributed). */
router.get("/review", async (_req, res) => {
  try {
    const meetings = await Meeting.find({ "attribution.needsReview": true })
      .sort({ "attribution.confidence": 1, start: -1 })
      .lean();
    res.json({ threshold: CONFIDENCE_THRESHOLD, count: meetings.length, meetings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /attribution/:googleEventId — human correction (feedback loop).
 * Body: { project: string|null }. Marks the attribution as human-confirmed so the LLM
 * run never overwrites it.
 */
router.patch("/:googleEventId", async (req, res) => {
  const { project } = req.body || {};
  try {
    const meeting = await Meeting.findOne({ googleEventId: req.params.googleEventId });
    if (!meeting) return res.status(404).json({ error: "Meeting not found." });

    meeting.attribution = {
      ...meeting.attribution.toObject?.() ?? meeting.attribution,
      project: project ?? null,
      confidence: 1,
      needsReview: false,
      method: "human",
    };
    await meeting.save();
    res.json({ ok: true, attribution: meeting.attribution });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
