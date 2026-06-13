# HR Cost Intelligence Engine — Build Progress

A running log of what's been built, phase by phase. Newest milestone notes at the bottom of each phase.

**Stack (fixed):** React + Vite + Recharts + `@react-oauth/google` · Node + Express · MongoDB Atlas · Replicate (`meta/meta-llama-3.1-8b-instruct`) · Google Calendar OAuth (read-only).

**Core chain:** meeting → project (AI-inferred) → cost (per attendee × duration) → roll-up per project → dashboard + anomalies.

---

## Status at a glance

| Phase | Title | Status |
|-------|-------|--------|
| 0 | Scaffold | ✅ Done |
| 1 | Calendar ingestion + seed | ✅ Done (Atlas verified; live OAuth ready to test in browser) |
| 2 | AI attribution | ✅ Done — **94.4% accuracy (17/18)**, target ≥85% met |
| 3 | Cost computation | ✅ Done — per-project rollup queryable (total ₹197,675) |
| 4 | Dashboard | ✅ Done — charts, drill-down, review queue (verified in browser) |
| 5 | Anomaly detection | ✅ Done — 4 rules, surfaced on dashboard (2 flags on demo data) |
| 6 | Privacy + polish | ✅ Done — k-anonymity, JWT admin gate, CSV export, skeletons, error boundary |

Legend: ⬜ not started · 🟡 in progress · ✅ done

---

## Gap fixes folded into the base spec
These were identified during plan review and are being built in from the start (not bolted on later):

- [x] **Meeting `description` + `location`** captured (in `Meeting` model + both sources). _Fed to model in Phase 2._
- [x] **`projects.budget` + `projects.priority`** fields (in `Project` model + seed).
- [x] **`employees.team` / `department`** field (in `Employee` model + seed).
- [x] **Ground-truth `trueProject` labels** in `sample-meetings.json`. _Eval harness in Phase 2._
- [x] **`singleEvents=true` + pagination** on `events.list` (`GoogleCalendarSource`).
- [x] **Skip declined attendees + meeting-room resources** — captured per attendee AND applied in `meetingCost()` (verified: declined arjun and the resource room are excluded).
- [x] **`users`/connections collection** persisting OAuth refresh tokens + admin flag (`User` model + `/auth/google`).
- [x] **Dedup by `googleEventId`** — unique index + upsert in `ingestService`.
- [x] **k-anonymity suppression** in aggregate views — `suppressSmallGroups()` applied in `aggregateByProject()`; groups with < `MIN_GROUP_SIZE` (3) distinct people return `null` cost + appear in `suppressed[]` list; dashboard renders dashed 🔒 placeholder.
- [x] **Correction feedback loop** — `PATCH /attribution/:id` persists human corrections as `method:"human"`; the LLM run never overwrites them. (Few-shot reuse still optional, Phase 4.)
- [x] **Over-allocation anomaly** — per-person meeting-hours vs available work hours + overlap (double-booking) detection in `anomalyService.js`.
- [x] **Attribution caching** — `attribution.modelHash` (sha256 of inputs+model); cached meetings are skipped unless `force`.

---

## Phase 0 — Scaffold ✅
_Goal: repo structure, client + server boot, env examples, Mongo connection, health route._

Built:
- `client/` (Vite + React 18, `@react-oauth/google`, Recharts, axios) — **production build passes**.
- `server/` (Express, ESM, `googleapis`, mongoose) — **all files syntax-clean**.
- `.env.example` in both; `.gitignore` excludes `.env` + `node_modules`.
- `server/src/config/db.js` Atlas connection; `GET /health` returns API + DB state.
- `server/src/config/constants.js` — named constants: `REPLICATE_MODEL`, `CONFIDENCE_THRESHOLD` (0.6), `ATTRIBUTION_BATCH_SIZE`, `MIN_GROUP_SIZE`, scope, window.

---

## Phase 1 — Calendar ingestion + seed 🟡
_Goal: Google OAuth (auth-code → backend token exchange) + `events.list` ingestion, mock fallback, seed script. Milestone: real meetings stored in Atlas._

Built:
- **Models:** `Employee` (team/band/rate), `Project` (budget/priority/keywords), `Meeting` (description/location/per-attendee responseStatus+resource, embedded `attribution`, `trueProject`), `User` (refresh token + isAdmin).
- **`CalendarSource` interface** with `GoogleCalendarSource` (live: `singleEvents=true`, pagination, declined/resource flags, all-day & cancelled skipped) and `MockCalendarSource` (sample data projected onto live dates).
- **OAuth:** `POST /auth/google` exchanges the auth code server-side, persists tokens, returns profile only (no tokens to client). Frontend uses `useGoogleLogin({ flow: "auth-code" })`.
- **Ingestion:** `POST /ingest` (`source: google|mock`) upserts by `googleEventId` (dedup); one bad event skipped, never aborts the batch. `GET /ingest/meetings` lists them.
- **Seed:** `npm run seed` loads 10 employees (4 teams) + 4 projects matching the sample labels.
- **UI:** connect Google / sync / load-mock buttons, health badge, meetings table with attribution status.

Verified:
- ✅ Client production build passes.
- ✅ `MockCalendarSource` fetches 18 events, projects dates into window, preserves 2 declined + 1 resource attendee.
- ✅ **Atlas connected + seeded** (10 employees, 4 projects).
- ✅ **Mock ingest end-to-end:** 18 meetings written to Atlas via `POST /ingest`; re-ingest stays at 18 (dedup by `googleEventId` confirmed).
- ⏳ Live Google OAuth: code is ready; needs an interactive browser sign-in to confirm (see notes below).

Notes / gotchas resolved:
- **DNS:** `mongodb+srv` SRV lookup got `ECONNREFUSED` from Node's resolver on this network. `db.js` now points Node's DNS at `8.8.8.8,1.1.1.1` (override via `DNS_SERVERS`). Atlas connect takes ~30s on first SRV lookup here.
- **OAuth popup flow:** `useGoogleLogin({ flow: 'auth-code' })` uses a popup → token exchange must use `redirect_uri: 'postmessage'` (fixed in `googleClient.js`). Set `OAUTH_REDIRECT_MODE=redirect` only if switching the frontend to redirect ux_mode.
- **Windows path:** repo path contains `]`; use PowerShell `-LiteralPath`, and run Node via PowerShell (the Bash tool's resolver can't do SRV).

To test live Google sign-in:
1. In Google Cloud Console → OAuth client: add Authorized JavaScript origin `http://localhost:5173`. Under OAuth consent screen, add your Google account as a **Test user** (if the app is in Testing).
2. Run server (`npm run dev` in `server/`) and client (`npm run dev` in `client/`).
3. Click **Connect Google Calendar** → consent → **Sync my Google Calendar**.

---

## Phase 2 — AI attribution ✅
_Goal: Replicate/Llama attribution with strict-JSON prompt, defensive parsing + retry, confidence threshold, caching, warmup, and an accuracy eval. Milestone: every meeting has an attribution._

Built:
- **LLM client** (`llm/replicateClient.js`): single `runModel()` wrapper, joins Llama's streamed chunks, low temperature for deterministic JSON, `warmup()` for demo cold-start, **automatic 429 retry** honoring `retry_after`.
- **Prompt + parser** (`llm/attribution.js`): strict-JSON prompt fed title + **description** + attendees + recurrence + project catalog; defensive parser strips fences/prose, extracts the first `{…}`, validates the project against known names (case-insensitive) or null, clamps confidence; `computeModelHash()` for caching.
- **Orchestrator** (`services/attributionService.js`): per-meeting attribution with one retry on malformed output, safe fallback (never throws), `confidence < 0.6 → needsReview`, **cache skip** via `modelHash`, **never overwrites human corrections**.
- **Eval harness** (`services/evalService.js`): scores attributed project vs `trueProject` over the labeled sample meetings; rewards correct `null` (abstaining on ambiguous ones).
- **Routes** (`routes/attribution.js`): `POST /attribution/warmup`, `POST /attribution/run` (`force`, `onlyUnattributed`), `GET /attribution/eval`, `GET /attribution/review` (queue), `PATCH /attribution/:googleEventId` (human correction).

Verified (against live Replicate + Atlas):
- ✅ Warmup succeeds; single-meeting call returns clean JSON.
- ✅ Full run on 18 meetings → **94.4% accuracy (17/18)**, `meetsTarget=true`. Only miss: "Atlas x Phoenix — Data Handoff" (a genuinely ambiguous cross-team meeting).
- ✅ Re-run with cache: unchanged meetings skipped (no re-call).

Notes / gotchas resolved:
- **Model name:** Replicate removed `meta/meta-llama-3.1-8b-instruct` (404). Switched the config constant to **`meta/meta-llama-3-8b-instruct`** (drop-in, same input schema). Upgrade path documented in `constants.js` (3-70b / llama-4-scout / llama-4-maverick).
- **Rate limit was the real bug:** the account is under $5 credit → Replicate throttles to **6 req/min, burst 1**. The first run fired 8 concurrent calls → 14/18 got `429` and fell back to `null` (22% accuracy). Fix: **concurrency 1** (`ATTRIBUTION_BATCH_SIZE=1`) + **429 retry honoring `retry_after`**. No provider switch needed — Llama itself was always returning correct answers. Raise concurrency once the account has >$5 credit.

---

## Phase 3 — Cost computation ✅
_Goal: per-attendee cost, external-attendee handling, per-project aggregation with filters. Milestone: "Project X costs ₹Y" is queryable._

Built (`services/costService.js`, `routes/cost.js`):
- **`meetingCost()`** — cost = Σ `hourlyRate × (durationMins/60)` over attendees; **skips declined + resource entries**; counts **external/uncosted** attendees separately (never silently ₹0). Optional team/role filter restricts which internal attendees are counted.
- **`aggregateByProject({from,to,team,role})`** — per-project totals with **by-team / by-role breakdowns**, person-hours, external count, an **unattributed bucket**, and **budget utilization / over-budget** flags joined from the `projects` collection. Sorted by cost desc.
- Routes: `GET /cost/projects` (filters via query string), `GET /cost/meeting/:googleEventId` (per-attendee drill-down).

Verified (live Atlas data):
- ✅ `mock-002` Phoenix Design Review = **₹11,300** (3500+5000+2800), meeting room **excluded**.
- ✅ `mock-004` Atlas Bugbash = **₹16,000** ((5000+3000)×2h), **declined** attendee excluded.
- ✅ Rollup: total **₹197,675** / 18 meetings / **4 external attendees**; Phoenix ₹74,300 (high, 14.9% of budget), Atlas ₹50,000, Internal Ops ₹41,000, Orion ₹27,300, unattributed ₹5,075.
- ✅ Drill-down by team/role and `?team=Engineering` filter (→ ₹71,500) both correct.

Note: per-meeting `contributors[].cost` derives an individual's rate — this drill-down is **admin-only** and will be gated in Phase 6 (privacy).

---

## Phase 4 — Dashboard ✅
_Goal: Recharts breakdowns with drill-downs + a visible review queue. (25% of judging.)_

Built (React, restructured into tabs):
- **Tabbed shell** (`App.jsx`): Dashboard · Review queue · Data & setup, with a live API/DB health badge.
- **Dashboard** (`components/Dashboard.jsx`): KPI cards (total HR cost, projects, meetings, external attendees, **attribution accuracy**, needs-review); an **anomaly flag strip** (over-budget + unattributed cost); **cost-per-project bar chart** and **cost-share pie** (Recharts); a project breakdown table with priority/budget/utilization; **click-to-drill-down** into by-team and by-role bar charts. Filters: **team selector + date range** (re-query the cost API).
- **Review queue** (`components/ReviewQueue.jsx`): all `needsReview` meetings with a confidence bar, a project picker, and **Confirm** wired to the `PATCH` correction (feedback loop); shows the live accuracy figure.
- **Data & setup** (`components/SetupPanel.jsx`): connect Google / sync / load-mock, **Warm up LLM** + **Attribute meetings** buttons, and the meetings table with a per-meeting **cost drill-down** (`view`).
- New backend `meta` routes (`/meta/projects`, `/meta/teams`) feed the dropdowns. Currency formatted as INR.

Verified (live in browser via preview):
- ✅ Dashboard renders real data: **₹1,97,675**, 4 projects, 18 meetings, 4 external, **94.4% accuracy**, flag strip showing ₹5,075 unattributed.
- ✅ Bar + pie charts render; **clicking a bar drills down** (tooltip ₹74,300, others dim) into by-team/by-role.
- ✅ Review queue lists the flagged meetings with confidence bars + project pickers.
- ✅ **Correction loop end-to-end:** PATCH a meeting → `method=human`, drops out of the queue (2→1), protected from re-runs; accuracy stays 94.4%.

Run it: `cd server; npm run dev` and `cd client; npm run dev` → http://localhost:5173

---

## Phase 5 — Anomaly detection ✅
_Goal: rule-based flags surfaced in the UI. (Innovation / 10%.)_

Built (`services/anomalyService.js`, `routes/anomaly.js`, `GET /anomalies`): one pass builds per-project and per-person rollups, then four rules read them. Thresholds are named constants in `config/constants.js`.

| Rule | Logic | Fires when |
|------|-------|-----------|
| **A · Over budget** | `cost / budget` per project | ≥100% (high) or ≥80% (medium) |
| **B · Attribution gap** | meetings with no project or confidence < 0.6 | any (low; ≥3 ⇒ medium) |
| **C · Over-allocation** | `meetingHours / (workdays × 8h)`; + interval-overlap scan | load ≥60% (medium); any overlap ⇒ double-booked (high) |
| **D · Senior on low-priority** | `lowPriorityCost / totalCost` for rate ≥ ₹5000/h | share ≥40% (medium) |

Verified (live DB) — **2 anomalies** on the demo data:
- ✅ **Attribution gap (MED):** 2 meetings (₹5,075) unattributed + 1 below confidence.
- ✅ **Senior on low-priority (MED):** Anita Rao — 50% of her ₹24,000 meeting cost (₹12,000, rate ₹8000/h) on low-priority work.
- ✅ No over-budget (utilizations 8–21%) and no over-allocation (peak load 4.5%) — rules present, honestly not triggered at demo scale. Double-booking scan finds none (no overlaps in the sample).
- ✅ Surfaced on the dashboard as a severity-ranked **Anomaly detection panel** with a meeting-load insight strip.

---

## Phase 6 — Privacy + Polish ✅
_Goal: k-anonymity suppression in aggregate views, admin-only gate on salary-derived drill-down, security headers, and UI polish (skeletons, error boundary, export)._

Built (server):
- **`middleware/auth.js`** — `requireAdmin` (401/403 on missing/invalid/non-admin JWT) and `optionalUser` (decodes token if present, never rejects) middleware.
- **`routes/auth.js`** — on successful Google OAuth, signs a short-lived **session JWT** (`{ email, name, isAdmin, exp: +8h }`) using `jsonwebtoken`; returned to client as `token` field.
- **`services/costService.js`** — `suppressSmallGroups()` enforces k-anonymity: any `byTeam`/`byRole` group with fewer than `MIN_GROUP_SIZE` (3) distinct attendees gets `null` cost + appears in `suppressed[]`.
- **`routes/cost.js`** — `GET /cost/meeting/:id` gated behind `requireAdmin`; `/cost/projects` remains open (only project-level aggregates).
- **`services/anomalyService.js`** — Rule D strips `email` and `rate` from anomaly metrics when `isAdmin=false`.
- **`routes/anomaly.js`** — uses `optionalUser`; passes `req.user?.isAdmin` into `detectAnomalies()`.
- **`index.js`** — four security headers added: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `X-XSS-Protection`.

Built (client):
- **`auth.js`** — `saveToken / getToken / clearToken` (sessionStorage), `isAdmin()` and `getSessionUser()` with base64 JWT payload decode + expiry check.
- **`api.js`** — Axios request interceptor attaches `Authorization: Bearer <token>`; `connectGoogle()` saves token on login.
- **`utils/exportCsv.js`** — CSV export with UTF-8 BOM (Excel-compatible); triggered via `⬇ Export CSV` button on project table.
- **`components/Skeleton.jsx`** — `SkeletonKpi`, `SkeletonKpiGrid`, `SkeletonTable` — CSS shimmer animation placeholders shown on initial data load.
- **`components/ErrorBoundary.jsx`** — class-based error boundary; renders a recovery card with "Try again" + "Reload page" buttons.
- **`App.jsx`** — restores session from JWT on mount; shows `🔑 Admin` badge in topbar; wraps content in `ErrorBoundary`; privacy notice in sidebar nav.
- **`components/Dashboard.jsx`** — `PrivacyNotice` card when groups are suppressed; Breakdown renders dashed 🔒 placeholder for `null`-cost groups; `SkeletonKpiGrid` + `SkeletonTable` on initial load; `⬇ Export CSV` button; admin-only footer notice.
- **`components/SetupPanel.jsx`** — `💸 View` cost button visible only for admins; others see `🔒 Admin only` badge.

Verified:
- ✅ `GET /cost/projects` returns `suppressed: ["Team: Design (2 people, min 3 required)"]` for small groups.
- ✅ `GET /cost/meeting/mock-001` returns 401 without token, 403 with non-admin token, 200 with valid admin JWT.
- ✅ `/anomalies` returns no `email`/`rate` in Rule D metrics for non-admin caller.
- ✅ All four security headers present on every response.
- ✅ Dashboard renders skeleton cards while data loads, transitions to live data.
- ✅ Export CSV downloads `hr-cost-projects.csv` with correct columns.
- ✅ Session persists across tab navigation; 🔑 Admin badge appears after Google login with admin email.
