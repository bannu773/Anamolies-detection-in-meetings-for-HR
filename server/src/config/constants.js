// Centralized config constants. Keep tunables here so they're easy to find and swap.

// --- LLM (Phase 2) ---
// NOTE: Replicate removed the meta-llama-3.1-* models. Using Llama 3 8B (drop-in: same
// prompt/system_prompt input schema). Accuracy upgrade path (just change this string):
//   "meta/meta-llama-3-70b-instruct"  — larger, more accurate, ~10x cost
//   "meta/llama-4-scout-instruct"     — newer Llama 4, strong + cheap
//   "meta/llama-4-maverick-instruct"  — newer Llama 4, largest
export const REPLICATE_MODEL = "meta/meta-llama-3-8b-instruct";

// Attribution confidence below this => flag the meeting for human review.
export const CONFIDENCE_THRESHOLD = 0.6;

// How many attribution calls to run concurrently. Replicate throttles low-credit
// accounts to ~6 req/min with a burst of 1, so keep this at 1 (sequential) to avoid
// 429s; runModel() also retries on 429. Raise this once the account has >$5 credit.
export const ATTRIBUTION_BATCH_SIZE = 1;

// --- Calendar ingestion ---
// Read-only scope: we never get write access to anyone's calendar.
export const GOOGLE_CALENDAR_SCOPE =
  "https://www.googleapis.com/auth/calendar.events.readonly";

// Default ingestion window if the client doesn't specify one (days back from now).
export const DEFAULT_WINDOW_DAYS = 30;

// Google events.list page size (max 2500).
export const EVENTS_PAGE_SIZE = 250;

// --- Cost / privacy ---
// Aggregate views suppress any group with fewer than this many people (k-anonymity),
// so a single-person bucket can't leak an individual's salary.
// Set to 2 for the demo dataset (10 employees, 4 projects) — k=3 suppresses too
// much data at this scale. Raise to 3-5 for production with larger employee counts.
export const MIN_GROUP_SIZE = 2;

// Assumed working hours per day, used by the over-allocation anomaly (Phase 5).
export const WORK_HOURS_PER_DAY = 8;

// --- Anomaly detection thresholds (Phase 5) ---
// Flag a project once its attributed HR cost reaches this fraction of its budget.
export const BUDGET_WARN_RATIO = 0.8;
// Flag a person if meeting hours exceed this fraction of their available work hours.
export const OVERALLOCATION_WARN_RATIO = 0.6;
// An hourly rate at/above this counts as "senior / expensive".
export const SENIOR_RATE_THRESHOLD = 5000;
// Flag a senior person if this fraction of their meeting cost lands on low-priority work.
export const LOW_PRIORITY_SHARE_THRESHOLD = 0.4;
// Number of unattributed/low-confidence meetings that escalates from "low" to "medium".
export const UNATTRIBUTED_CLUSTER_SIZE = 3;

// --- Auth / JWT (Phase 6) ---
// Secret used to sign session JWTs. In production this MUST be a long random string
// set via the JWT_SECRET env variable; the fallback is only for local dev.
export const JWT_SECRET = process.env.JWT_SECRET || "hr-cost-engine-dev-secret-change-in-prod";
// How long a session token is valid (in seconds). 8 hours covers a full work day.
export const JWT_EXPIRES_IN = 8 * 60 * 60; // 8 hours
