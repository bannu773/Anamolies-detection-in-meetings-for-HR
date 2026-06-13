import { useEffect, useState, useMemo } from "react";
import { getMeetings, getMeetingCost, getProjectsMeta, formatINR } from "../api.js";

const PROJECT_COLORS = [
  "#6366f1", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#06b6d4", "#f97316", "#ec4899",
];

function projectColor(name, projects) {
  const idx = projects.findIndex((p) => p === name);
  return PROJECT_COLORS[idx >= 0 ? idx % PROJECT_COLORS.length : 0];
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

function formatDuration(mins) {
  if (!mins) return "—";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export default function MeetingsPage({ isAdmin = false }) {
  const [meetings, setMeetings]   = useState([]);
  const [projects, setProjects]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [filterProj, setFilterProj] = useState("");
  const [filterStatus, setFilterStatus] = useState(""); // "attributed" | "review" | ""
  const [expanded, setExpanded]   = useState(null);   // googleEventId
  const [costData, setCostData]   = useState({});     // eventId -> cost breakdown
  const [costLoading, setCostLoading] = useState({}); // eventId -> bool

  useEffect(() => {
    Promise.all([getMeetings(), getProjectsMeta()])
      .then(([m, p]) => {
        setMeetings(m.meetings || []);
        setProjects((p || []).map((x) => x.name));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function loadCost(eventId) {
    if (costData[eventId] || costLoading[eventId]) return;
    setCostLoading((prev) => ({ ...prev, [eventId]: true }));
    try {
      const data = await getMeetingCost(eventId);
      setCostData((prev) => ({ ...prev, [eventId]: data }));
    } catch (e) {
      setCostData((prev) => ({ ...prev, [eventId]: { error: e.response?.data?.error || "Access denied" } }));
    } finally {
      setCostLoading((prev) => ({ ...prev, [eventId]: false }));
    }
  }

  function toggleExpand(eventId) {
    const next = expanded === eventId ? null : eventId;
    setExpanded(next);
    if (next && isAdmin) loadCost(next);
  }

  const filtered = useMemo(() => {
    return meetings.filter((m) => {
      const q = search.toLowerCase();
      const titleMatch = !q || m.title?.toLowerCase().includes(q);
      const projMatch  = !filterProj || m.attribution?.project === filterProj;
      const statusMatch =
        !filterStatus ||
        (filterStatus === "review" && m.attribution?.needsReview) ||
        (filterStatus === "attributed" && !m.attribution?.needsReview && m.attribution?.project);
      return titleMatch && projMatch && statusMatch;
    });
  }, [meetings, search, filterProj, filterStatus]);

  // Stats
  const totalHours    = meetings.reduce((s, m) => s + (m.durationMins || 0) / 60, 0);
  const attributed    = meetings.filter((m) => m.attribution?.project && !m.attribution?.needsReview).length;
  const needsReview   = meetings.filter((m) => m.attribution?.needsReview).length;
  const unattributed  = meetings.filter((m) => !m.attribution?.project).length;

  return (
    <div className="fade-in">
      {/* ── Stats Row ── */}
      <div className="kpi-grid" style={{ marginBottom: 24, gridTemplateColumns: "repeat(4, 1fr)" }}>
        <StatCard icon="📅" label="Total Meetings" value={meetings.length} />
        <StatCard icon="⏱️" label="Total Hours"    value={`${totalHours.toFixed(1)}h`} />
        <StatCard icon="✅" label="Attributed"     value={attributed}  type="success" />
        <StatCard icon="⚠️" label="Needs Review"   value={needsReview} type={needsReview > 0 ? "warn" : "success"} />
      </div>

      {/* ── Search & Filter bar ── */}
      <div className="card mb-6">
        <div className="filter-row" style={{ flexWrap: "wrap", gap: 12 }}>
          {/* Search */}
          <div className="filter-group" style={{ flex: "1 1 220px" }}>
            <span className="filter-label">🔍 Search</span>
            <input
              type="text"
              placeholder="Meeting title…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: "100%" }}
            />
          </div>
          {/* Project filter */}
          <div className="filter-group">
            <span className="filter-label">📁 Project</span>
            <select value={filterProj} onChange={(e) => setFilterProj(e.target.value)}>
              <option value="">All Projects</option>
              {projects.map((p) => <option key={p} value={p}>{p}</option>)}
              <option value="__none__">Unattributed</option>
            </select>
          </div>
          {/* Status filter */}
          <div className="filter-group">
            <span className="filter-label">📊 Status</span>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="attributed">✅ Attributed</option>
              <option value="review">⚠️ Needs Review</option>
            </select>
          </div>
          {(search || filterProj || filterStatus) && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => { setSearch(""); setFilterProj(""); setFilterStatus(""); }}
              style={{ alignSelf: "flex-end" }}
            >
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Meeting Cards ── */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <span className="card-title-icon">📅</span>
            All Meetings
          </div>
          <span className="badge badge-muted">
            {filtered.length} of {meetings.length}
          </span>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="empty-icon spinning" style={{ fontSize: 32 }}>⟳</div>
            <div className="empty-title">Loading meetings…</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <div className="empty-title">No meetings found</div>
            <div className="empty-sub">
              {meetings.length === 0
                ? "Go to Data & Setup and run the ingestion pipeline first."
                : "Try adjusting your search or filters."}
            </div>
          </div>
        ) : (
          <div className="meetings-list">
            {filtered.map((m) => {
              const proj      = m.attribution?.project;
              const review    = m.attribution?.needsReview;
              const isExpanded = expanded === m.googleEventId;
              const color     = proj ? projectColor(proj, projects) : "#4b5563";

              return (
                <div
                  key={m.googleEventId}
                  className={`meeting-card ${isExpanded ? "expanded" : ""}`}
                  onClick={() => toggleExpand(m.googleEventId)}
                >
                  {/* Left accent stripe */}
                  <div className="meeting-accent" style={{ background: color }} />

                  {/* Main row */}
                  <div className="meeting-body">
                    <div className="meeting-top">
                      {/* Title + badges */}
                      <div className="meeting-title-row">
                        <span className="meeting-title">{m.title || "Untitled Meeting"}</span>
                        <div className="meeting-badges">
                          {m.recurrence && (
                            <span className="badge badge-muted" style={{ fontSize: 10 }}>🔁 Recurring</span>
                          )}
                          {review ? (
                            <span className="badge badge-amber">⚠ Review</span>
                          ) : proj ? (
                            <span
                              className="badge"
                              style={{
                                background: `${color}22`,
                                color: color,
                                border: `1px solid ${color}55`,
                              }}
                            >
                              ✓ {proj}
                            </span>
                          ) : (
                            <span className="badge badge-muted">Unattributed</span>
                          )}
                        </div>
                      </div>

                      {/* Meta info row */}
                      <div className="meeting-meta">
                        <span className="meta-item">🗓 {formatDate(m.start)}</span>
                        <span className="meta-divider">·</span>
                        <span className="meta-item">⏱ {formatDuration(m.durationMins)}</span>
                        <span className="meta-divider">·</span>
                        <span className="meta-item">👥 {m.attendees?.length ?? 0} attendees</span>
                        {m.attribution?.confidence != null && (
                          <>
                            <span className="meta-divider">·</span>
                            <span className="meta-item">
                              🎯 {Math.round(m.attribution.confidence * 100)}% confidence
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Expand chevron */}
                    <div
                      className="meeting-chevron"
                      style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}
                    >
                      ›
                    </div>
                  </div>

                  {/* Expanded detail panel */}
                  {isExpanded && (
                    <div className="meeting-detail" onClick={(e) => e.stopPropagation()}>
                      {/* Attendees list */}
                      <div className="detail-section">
                        <div className="detail-label">👥 Attendees</div>
                        <div className="attendee-chips">
                          {(m.attendees || []).map((a) => (
                            <span
                              key={a.email}
                              className="attendee-chip"
                              style={{
                                opacity: a.responseStatus === "declined" ? 0.4 : 1,
                                textDecoration: a.responseStatus === "declined" ? "line-through" : "none",
                              }}
                              title={a.email}
                            >
                              {a.displayName || a.email}
                              {a.responseStatus === "declined" && " (declined)"}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Attribution info */}
                      {proj && (
                        <div className="detail-section">
                          <div className="detail-label">📁 Attribution</div>
                          <div className="detail-row">
                            <span>Project:</span>
                            <span style={{ color, fontWeight: 600 }}>{proj}</span>
                          </div>
                          {m.attribution?.method && (
                            <div className="detail-row">
                              <span>Method:</span>
                              <span className="badge badge-muted" style={{ textTransform: "capitalize" }}>
                                {m.attribution.method}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Cost section — admin only */}
                      <div className="detail-section">
                        <div className="detail-label">💰 Meeting Cost</div>
                        {!isAdmin ? (
                          <div
                            style={{
                              display: "flex", alignItems: "center", gap: 8,
                              padding: "10px 14px", borderRadius: 8,
                              background: "var(--surface-3)",
                              border: "1px dashed rgba(129,140,248,0.3)",
                              fontSize: 13, color: "var(--text-3)",
                            }}
                          >
                            🔒 Per-attendee cost breakdown is admin-only (contains salary data)
                          </div>
                        ) : costLoading[m.googleEventId] ? (
                          <div className="text-sm text-muted flex items-center gap-2">
                            <span className="spinning">⟳</span> Loading cost data…
                          </div>
                        ) : costData[m.googleEventId]?.error ? (
                          <div className="text-sm" style={{ color: "var(--danger)" }}>
                            ⚠ {costData[m.googleEventId].error}
                          </div>
                        ) : costData[m.googleEventId] ? (
                          <div>
                            <div className="cost-total-row">
                              <span className="text-sm text-muted">Total meeting cost:</span>
                              <span style={{ fontWeight: 700, color: "var(--accent)", fontSize: 18 }}>
                                {formatINR(costData[m.googleEventId].cost)}
                              </span>
                            </div>
                            <div className="cost-attendee-table">
                              <div className="cost-table-header">
                                <span>Name</span>
                                <span>Role / Team</span>
                                <span>Hours</span>
                                <span>Cost</span>
                              </div>
                              {(costData[m.googleEventId].contributors || []).map((c) => (
                                <div key={c.email} className="cost-table-row">
                                  <span>
                                    <div style={{ fontWeight: 600 }}>{c.name}</div>
                                    <div style={{ fontSize: 11, color: "var(--text-3)" }}>{c.email}</div>
                                  </span>
                                  <span>
                                    <div>{c.role}</div>
                                    <div style={{ fontSize: 11, color: "var(--text-3)" }}>{c.team}</div>
                                  </span>
                                  <span>{c.hours?.toFixed(1)}h</span>
                                  <span style={{ fontWeight: 600, color: "var(--success)" }}>
                                    {formatINR(c.cost)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-muted">Click to load cost data.</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, type = "" }) {
  return (
    <div className={`kpi-card ${type}`} style={{ cursor: "default" }}>
      <div className="kpi-header">
        <div className="kpi-icon-wrap">{icon}</div>
      </div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
    </div>
  );
}
