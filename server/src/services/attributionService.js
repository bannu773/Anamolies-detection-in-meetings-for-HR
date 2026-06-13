import { Meeting } from "../models/Meeting.js";
import { Project } from "../models/Project.js";
import { runModel, REPLICATE_MODEL } from "../llm/replicateClient.js";
import {
  buildProjectContext,
  buildUserPrompt,
  computeModelHash,
  parseAttribution,
  SYSTEM_PROMPT,
} from "../llm/attribution.js";
import { CONFIDENCE_THRESHOLD, ATTRIBUTION_BATCH_SIZE } from "../config/constants.js";

/**
 * Attribute a single meeting. Calls the model, parses defensively, retries once on
 * malformed output, and on total failure returns a safe fallback (null / needsReview)
 * rather than throwing — one bad meeting must not abort the run.
 */
async function attributeOne(meeting, projects, projectContext, validNames) {
  const system = SYSTEM_PROMPT;
  const prompt = buildUserPrompt(meeting, projects, projectContext);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await runModel({ prompt, system, maxTokens: 120 });
      const parsed = parseAttribution(text, validNames);
      if (parsed) {
        const needsReview = !parsed.project || parsed.confidence < CONFIDENCE_THRESHOLD;
        return {
          project: parsed.project,
          confidence: parsed.confidence,
          needsReview,
          method: "llm",
        };
      }
      // malformed → loop retries once
    } catch (err) {
      // transient API error → retry once, then fall through to fallback
      if (attempt === 1) console.warn(`[attr] ${meeting.googleEventId} failed: ${err.message}`);
    }
  }

  return { project: null, confidence: 0, needsReview: true, method: "fallback" };
}

/** Process an array in fixed-size concurrent batches, returning all results in order. */
async function inBatches(items, size, worker) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    const slice = items.slice(i, i + size);
    const results = await Promise.all(slice.map(worker));
    out.push(...results);
  }
  return out;
}

/**
 * Run attribution across meetings.
 * @param {{ force?: boolean, onlyUnattributed?: boolean }} opts
 *   - onlyUnattributed (default true): skip meetings already attributed by llm/human.
 *   - force: re-run even if the cache hash matches.
 */
export async function runAttribution({ force = false, onlyUnattributed = true } = {}) {
  const projects = await Project.find().lean();
  if (!projects.length) throw new Error("No projects seeded — run `npm run seed` first.");

  const projectContext = buildProjectContext(projects);
  const validNames = projects.map((p) => p.name);

  const query = onlyUnattributed
    ? { $or: [{ "attribution.method": "pending" }, { "attribution.method": "fallback" }] }
    : {};
  const meetings = await Meeting.find(query);

  let attributed = 0;
  let cached = 0;
  let flagged = 0;
  let humanSkipped = 0;

  await inBatches(meetings, ATTRIBUTION_BATCH_SIZE, async (m) => {
    // Never overwrite a human correction.
    if (m.attribution?.method === "human") {
      humanSkipped++;
      return;
    }

    const hash = computeModelHash(m, projects, REPLICATE_MODEL);
    if (!force && m.attribution?.modelHash === hash && m.attribution?.method === "llm") {
      cached++;
      return;
    }

    const result = await attributeOne(m, projects, projectContext, validNames);
    m.attribution = { ...result, modelHash: hash };
    await m.save();

    attributed++;
    if (result.needsReview) flagged++;
  });

  return {
    model: REPLICATE_MODEL,
    confidenceThreshold: CONFIDENCE_THRESHOLD,
    considered: meetings.length,
    attributed,
    cached,
    flaggedForReview: flagged,
    humanSkipped,
  };
}
