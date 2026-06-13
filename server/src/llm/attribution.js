import crypto from "node:crypto";

/**
 * Build the compact project catalog the model classifies against.
 * Kept terse so it fits comfortably in context even with many projects.
 */
export function buildProjectContext(projects) {
  return projects
    .map((p, i) => {
      const kw = (p.keywords || []).join(", ");
      return `${i + 1}. ${p.name} — ${p.description || "(no description)"}${kw ? ` [keywords: ${kw}]` : ""}`;
    })
    .join("\n");
}

const SYSTEM_PROMPT =
  "You are a meeting-to-project classifier for an HR cost tool. " +
  "You map a single calendar meeting to exactly one project from a fixed list, or to null " +
  "if none clearly applies. You respond with ONE JSON object and nothing else — no prose, " +
  "no markdown, no code fences.";

/**
 * Build the user prompt for one meeting. We feed title, description (strong signal),
 * attendee emails, and recurrence. The model must echo the EXACT project name or null.
 */
export function buildUserPrompt(meeting, projects, projectContext) {
  const attendees = (meeting.attendees || []).map((a) => a.email).join(", ") || "(none)";
  const recurrence = meeting.recurrence ? "yes" : "no";
  const names = projects.map((p) => `"${p.name}"`).join(", ");

  return [
    "PROJECTS (choose the project name EXACTLY as written, or null):",
    projectContext,
    "",
    "MEETING:",
    `- title: ${meeting.title || "(no title)"}`,
    `- description: ${meeting.description ? meeting.description.slice(0, 500) : "(none)"}`,
    `- attendees: ${attendees}`,
    `- recurring: ${recurrence}`,
    "",
    `Valid project values: [${names}, null].`,
    'Respond with exactly: {"project": <one valid value>, "confidence": <number 0-1>}',
    "confidence = how sure you are. Use null with low confidence when nothing fits.",
  ].join("\n");
}

/** Stable cache key: same meeting inputs + same project catalog + same model => same hash. */
export function computeModelHash(meeting, projects, model) {
  const payload = JSON.stringify({
    model,
    title: meeting.title,
    description: meeting.description,
    attendees: (meeting.attendees || []).map((a) => a.email).sort(),
    recurrence: meeting.recurrence,
    projects: projects.map((p) => ({ n: p.name, d: p.description, k: p.keywords })),
  });
  return crypto.createHash("sha256").update(payload).digest("hex");
}

/**
 * Defensively parse the model's text into { project, confidence }.
 * - strips code fences / prose, extracts the first {...} block
 * - validates project against the known names (case-insensitive), else null
 * - clamps confidence to [0,1]
 * Returns null if no usable JSON was found (caller decides retry / fallback).
 */
export function parseAttribution(text, validProjectNames) {
  if (!text) return null;

  // Grab the first balanced-looking object. Greedy from first '{' to last '}'.
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last < first) return null;

  const slice = text.slice(first, last + 1);
  let obj;
  try {
    obj = JSON.parse(slice);
  } catch {
    return null;
  }

  // Normalize project to an exact known name, or null.
  let project = null;
  if (obj.project != null && typeof obj.project === "string") {
    const match = validProjectNames.find(
      (n) => n.toLowerCase() === obj.project.trim().toLowerCase()
    );
    project = match || null;
  }

  let confidence = Number(obj.confidence);
  if (!Number.isFinite(confidence)) confidence = project ? 0.5 : 0;
  confidence = Math.max(0, Math.min(1, confidence));

  return { project, confidence };
}

export { SYSTEM_PROMPT };
