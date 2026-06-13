import { useEffect, useState } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import {
  connectGoogle, ingest, getMeetings, warmup, runAttribution, formatINR, getMeetingCost,
} from "../api.js";

export default function SetupPanel({ user, setUser, isAdmin = false }) {
  const [meetings, setMeetings] = useState([]);
  const [status, setStatus]     = useState("");
  const [statusType, setStatusType] = useState("success");
  const [busy, setBusy]         = useState(false);
  const [costRow, setCostRow]   = useState(null);

  useEffect(() => { refresh(); }, []); // eslint-disable-line

  async function refresh() {
    try {
      const d = await getMeetings();
      setMeetings(d.meetings || []);
    } catch {}
  }

  function setMsg(msg, type = "success") {
    setStatus(msg);
    setStatusType(type);
  }

  const login = useGoogleLogin({
    flow: "auth-code",
    scope: "https://www.googleapis.com/auth/calendar.events.readonly",
    onSuccess: async ({ code }) => {
      setBusy(true);
      setMsg("Exchanging Google auth code…", "loading");
      try {
        const res = await connectGoogle(code);
        setUser(res.user);
        setMsg(`Connected as ${res.user.email}${res.user.isAdmin ? " (admin)" : ""}. ✓`);
      } catch (e) {
        setMsg("Google connect failed: " + (e.response?.data?.error || e.message), "error");
      } finally { setBusy(false); }
    },
    onError: () => setMsg("Google login cancelled or failed.", "error"),
  });

  async function runIngest(source) {
    setBusy(true);
    setMsg(`Ingesting from ${source}…`, "loading");
    try {
      const res = await ingest({ email: user?.email, source, windowDays: 30 });
      setMsg(`✓ Ingested from ${res.source}: ${res.upserted} upserted, ${res.skipped} skipped, ${res.errors.length} errors.`);
      await refresh();
    } catch (e) {
      setMsg("Ingestion failed: " + (e.response?.data?.error || e.message), "error");
    } finally { setBusy(false); }
  }

  async function doWarmup() {
    setBusy(true);
    setMsg("Warming up the LLM (cold start ~30s)…", "loading");
    try {
      const r = await warmup();
      setMsg(r.warmedUp ? "✓ LLM warmed up and ready." : "⚠ Warmup failed — check REPLICATE_API_TOKEN.", r.warmedUp ? "success" : "error");
    } finally { setBusy(false); }
  }

  async function doAttribution() {
    setBusy(true);
    setMsg("Running AI attribution (sequential; ~2–3 min on rate-limited account)…", "loading");
    try {
      const r = await runAttribution({ onlyUnattributed: false, force: false });
      setMsg(`✓ Attributed ${r.attributed}, cached ${r.cached}, flagged ${r.flaggedForReview} for review.`);
      await refresh();
    } catch (e) {
      setMsg("Attribution failed: " + (e.response?.data?.error || e.message), "error");
    } finally { setBusy(false); }
  }

  async function showCost(id) {
    try { setCostRow(await getMeetingCost(id)); } catch {}
  }

  return (
    <div className="fade-in">
      {/* ── Pipeline steps ── */}
      <div className="card mb-6">
        <div className="card-header">
          <div className="card-title">
            <span className="card-title-icon">⚙️</span>
            Data Pipeline
          </div>
          <span className="badge badge-muted">3 steps</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Step 1 */}
          <div className="setup-step">
            <div className="step-num">1</div>
            <div className="step-content">
              <div className="step-title">Connect Calendar Source</div>
              <div className="step-desc">
                Link your Google Calendar to pull real meeting data, or load the sample dataset to explore the dashboard instantly.
              </div>
              {user && (
                <div className="flex items-center gap-2" style={{ marginTop: 8 }}>
                  <span className="badge badge-green">✓ Connected</span>
                  <span className="text-sm text-muted">{user.email}{user.isAdmin ? " · admin" : ""}</span>
                </div>
              )}
              <div className="step-actions">
                <button
                  id="btn-connect-google"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => login()}
                >
                  {busy ? <span className="spinning">⟳</span> : "🔗"}
                  {user ? "Reconnect Google" : "Connect Google Calendar"}
                </button>
                <button
                  id="btn-sync-google"
                  className="btn"
                  disabled={busy || !user}
                  onClick={() => runIngest("google")}
                >
                  ↻ Sync my Google Calendar
                </button>
                <button
                  id="btn-load-mock"
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={() => runIngest("mock")}
                >
                  📋 Load sample data
                </button>
              </div>
            </div>
          </div>

          <hr className="section-divider" />

          {/* Step 2 */}
          <div className="setup-step">
            <div className="step-num">2</div>
            <div className="step-content">
              <div className="step-title">Run AI Attribution</div>
              <div className="step-desc">
                Llama 3 maps each meeting to a project using title, description, attendees, and recurrence signals.
                Warm up first to avoid cold-start latency (~30s). Cached meetings are skipped automatically.
              </div>
              <div className="step-actions">
                <button
                  id="btn-warmup"
                  className="btn"
                  disabled={busy}
                  onClick={doWarmup}
                >
                  {busy ? <span className="spinning">⟳</span> : "🔥"} Warm up LLM
                </button>
                <button
                  id="btn-attribute"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={doAttribution}
                >
                  {busy ? <span className="spinning">⟳</span> : "🧠"} Attribute Meetings
                </button>
              </div>
            </div>
          </div>

          <hr className="section-divider" />

          {/* Step 3 */}
          <div className="setup-step">
            <div className="step-num">3</div>
            <div className="step-content">
              <div className="step-title">Review &amp; Refine</div>
              <div className="step-desc">
                Low-confidence attributions appear in the <strong>Review Queue</strong> tab.
                Human corrections are permanent and won't be overwritten on re-runs.
              </div>
              <div className="step-actions">
                <div className="badge badge-indigo" style={{ padding: "6px 12px" }}>
                  → Switch to "Review Queue" tab in the sidebar
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Status message ── */}
      {status && (
        <div className={`status-msg ${statusType} mb-6`}>
          {statusType === "loading" && <span className="spinning">⟳</span>}
          {statusType === "success" && "✓"}
          {statusType === "error" && "✕"}
          <span>{status}</span>
        </div>
      )}

      {/* ── Meetings table ── */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <span className="card-title-icon">📅</span>
            Ingested Meetings
            <span className="badge badge-muted">{meetings.length}</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={refresh}>
            ↻ Refresh
          </button>
        </div>

        {meetings.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <div className="empty-title">No meetings yet</div>
            <div className="empty-sub">
              Connect Google Calendar and sync, or click "Load sample data" above to get started.
            </div>
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Start</th>
                    <th>Duration</th>
                    <th>Attendees</th>
                    <th>Attribution</th>
                    <th>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {meetings.map((m) => (
                    <tr key={m.googleEventId}>
                      <td>
                        <div style={{ fontWeight: 600, color: "var(--text)" }}>{m.title}</div>
                        {m.recurrence && (
                          <span className="badge badge-indigo" style={{ marginTop: 3 }}>🔁 recurring</span>
                        )}
                      </td>
                      <td className="nowrap text-muted">
                        {new Date(m.start).toLocaleString("en-IN", {
                          day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                        })}
                      </td>
                      <td className="text-muted">{m.durationMins} min</td>
                      <td className="text-muted">{m.attendees?.length || 0}</td>
                      <td>
                        {m.attribution?.project ? (
                          <span className="badge badge-blue">{m.attribution.project}</span>
                        ) : (
                          <span className="badge badge-muted">{m.attribution?.method || "pending"}</span>
                        )}
                      </td>
                      <td>
                        {isAdmin ? (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => showCost(m.googleEventId)}
                          >
                            💸 View
                          </button>
                        ) : (
                          <span
                            className="badge badge-muted"
                            title="Log in as an admin to view per-attendee costs"
                          >
                            🔒 Admin only
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cost detail */}
            {costRow && (
              <div className="cost-detail-card">
                <div className="flex items-center justify-between mb-2">
                  <strong style={{ color: "var(--text)" }}>
                    {costRow.title} — {formatINR(costRow.cost)}
                  </strong>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setCostRow(null)}
                  >
                    ✕
                  </button>
                </div>
                <div className="text-xs text-muted" style={{ marginBottom: 10 }}>
                  {costRow.internalCount} internal · {costRow.externalCount} external · {costRow.personHours} person-hrs
                </div>
                <table>
                  <tbody>
                    {costRow.contributors.map((c) => (
                      <tr key={c.email}>
                        <td>
                          <strong>{c.name}</strong>
                          <span className="text-muted" style={{ marginLeft: 6 }}>({c.role})</span>
                        </td>
                        <td style={{ textAlign: "right", color: "var(--primary)", fontWeight: 600 }}>
                          {formatINR(c.cost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
