# HR Cost Intelligence Engine

Know what your meetings are costing you — in real time.

Ingests calendar meeting data, uses an LLM to attribute each meeting to a project, prices
each attendee by role, and rolls everything up into **HR cost per project** on a
dashboard, with anomaly flags.

**Core chain:** meeting → project (AI-inferred) → cost (per attendee × duration) → roll-up per project.

## Stack
- **Frontend:** React + Vite, Recharts, `@react-oauth/google`
- **Backend:** Node + Express
- **Database:** MongoDB Atlas
- **LLM:** Replicate — `meta/meta-llama-3.1-8b-instruct`
- **Calendar:** Google Calendar OAuth 2.0 (read-only)

## Repo layout
```
client/   React + Vite frontend
server/   Node + Express API, MongoDB models, calendar ingestion
```

## Setup

### 1. Backend
```bash
cd server
cp .env.example .env        # fill in MONGODB_URI, Google + Replicate creds
npm install
npm run seed                # load sample employees + projects
npm run dev                 # http://localhost:8000
```

### 2. Frontend
```bash
cd client
cp .env.example .env        # set VITE_GOOGLE_CLIENT_ID + VITE_API_BASE_URL
npm install
npm run dev                 # http://localhost:5173
```

### Google Cloud setup
1. Create an OAuth 2.0 Client ID (Web application) in Google Cloud Console.
2. Authorized JavaScript origin: `http://localhost:5173`
3. Authorized redirect URI: `http://localhost:8000/auth/google/callback`
4. Enable the **Google Calendar API**.
5. Put the client ID + secret in `server/.env`, and the same client ID in `client/.env`.

## Demo safety net
No Google credentials handy? Click **Load sample data (mock)** in the UI, or set
`CALENDAR_SOURCE=mock` in `server/.env`. This reads `server/src/calendar/sample-meetings.json`
(which includes ground-truth project labels used by the accuracy eval).

## API (so far)
| Method | Route | Purpose |
|--------|-------|---------|
| GET  | `/health` | Liveness + DB state |
| POST | `/auth/google` | Exchange auth code → store tokens, return profile |
| POST | `/ingest` | Pull calendar events into `meetings` (`source: google\|mock`) |
| GET  | `/ingest/meetings` | List stored meetings |

See [PROGRESS.md](PROGRESS.md) for the phase-by-phase build log.
