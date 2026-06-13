import { Router } from "express";
import { ingestMeetings } from "../services/ingestService.js";
import { Meeting } from "../models/Meeting.js";
import { User } from "../models/User.js";

const router = Router();

/**
 * POST /ingest
 * Body: { email?, source?, windowDays? }
 *   - source "mock" needs no user; "google" requires a connected user (by email).
 * Pulls calendar events into the meetings collection.
 */
router.post("/", async (req, res) => {
  const { email, source, windowDays } = req.body || {};
  const chosen = (source || process.env.CALENDAR_SOURCE || "google").toLowerCase();

  try {
    let user = null;
    if (chosen !== "mock") {
      if (!email) return res.status(400).json({ error: "email is required for the Google source." });
      user = await User.findOne({ email: email.toLowerCase() });
      if (!user) return res.status(404).json({ error: "No connected user for that email. Connect Google first." });
      if (!user.refreshToken && !user.accessToken) {
        return res.status(400).json({ error: "User has no stored Google credentials. Reconnect." });
      }
    }

    const result = await ingestMeetings({ user, source: chosen, windowDays });

    if (user) {
      user.lastSyncedAt = new Date();
      await user.save();
    }

    res.json(result);
  } catch (err) {
    console.error("[ingest] error:", err.message);
    res.status(500).json({ error: "Ingestion failed.", detail: err.message });
  }
});

/** GET /ingest/meetings — list stored meetings (most recent first) for quick inspection. */
router.get("/meetings", async (_req, res) => {
  try {
    const meetings = await Meeting.find().sort({ start: -1 }).limit(200).lean();
    res.json({ count: meetings.length, meetings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
