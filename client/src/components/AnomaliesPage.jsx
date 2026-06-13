import { useEffect, useState } from "react";
import { getAnomalies } from "../api.js";

const SEV = {
  high:   { emoji: "🔴", label: "HIGH",   color: "#ef4444", bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.25)"   },
  medium: { emoji: "🟡", label: "MEDIUM", color: "#f59e0b", bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.25)"  },
  low:    { emoji: "⚪", label: "LOW",    color: "#6b7a99", bg: "rgba(107,122,153,0.08)", border: "rgba(107,122,153,0.2)"  },
};

const RULE_ICONS = {
  A: "💰",
  B: "👤",
  C: "🕐",
  D: "📋",
};

function RuleBadge({ rule }) {
  const icon = RULE_ICONS[rule] || "⚡";
  return (
    <span
      style={{
        fontSize: 11, padding: "2px 8px", borderRadius: 20,
        background: "var(--surface-3)", border: "1px solid var(--border)",
        color: "var(--text-3)", fontWeight: 600, letterSpacing: "0.05em",
        display: "inline-flex", alignItems: "center", gap: 4,
      }}
    >
      {icon} Rule {rule}
    </span>
  );
}

export default function AnomaliesPage() {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [filters, setFilters]   = useState({ from: "", to: "" });
  const [sevFilter, setSevFilter] = useState(""); // "high"|"medium"|"low"|""
  const [expanded, setExpanded] = useState(null);

  useEffect(() => { load(); }, [filters]); // eslint-disable-line

  async function load() {
    setLoading(true);
    try {
      const res = await getAnomalies({
        from: filters.from || undefined,
        to:   filters.to   || undefined,
      });
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  const all      = data?.anomalies || [];
  const busiest  = data?.insights?.busiestPeople || [];
  const counts   = data?.counts || {};

  const filtered = sevFilter ? all.filter((a) => a.severity === sevFilter) : all;

  return (
    <div className="fade-in">

      {/* ── Stats row ── */}
      <div className="kpi-grid" style={{ marginBottom: 24, gridTemplateColumns: "repeat(4, 1fr)" }}>
        <AnomalyStatCard
          label="Total Anomalies"  value={all.length}           emoji="🚨"
          type={all.length > 0 ? "warn" : "success"}
        />
        <AnomalyStatCard
          label="High Severity"    value={counts.high   ?? 0}  emoji="🔴"
          type={counts.high > 0 ? "danger" : "success"}
        />
        <AnomalyStatCard
          label="Medium Severity"  value={counts.medium ?? 0}  emoji="🟡"
          type={counts.medium > 0 ? "warn" : "success"}
        />
        <AnomalyStatCard
          label="Low Severity"     value={counts.low    ?? 0}  emoji="⚪"
          type=""
        />
      </div>

      {/* ── Meeting load bar ── */}
      {busiest.length > 0 && (
        <div className="card mb-6">
          <div className="card-header">
            <div className="card-title">
              <span className="card-title-icon">📊</span>
              Meeting Load — Top Contributors
            </div>
            <span className="text-xs text-muted">% of weekly work hours spent in meetings</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, paddingTop: 4 }}>
            {busiest.map((b) => {
              const pct  = b.loadPct || 0;
              const fill = pct > 60 ? "#ef4444" : pct > 40 ? "#f59e0b" : "#10b981";
              return (
                <div
                  key={b.email}
                  style={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    padding: "12px 16px",
                    minWidth: 200,
                    flex: "1 1 200px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>{b.name}</div>
                      <div style={{ fontSize: 11, color: "var(--text-3)" }}>{b.email}</div>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 18, color: fill }}>{pct}%</div>
                  </div>
                  {/* Load bar */}
                  <div style={{
                    height: 5, borderRadius: 3,
                    background: "var(--surface-3)", overflow: "hidden",
                  }}>
                    <div style={{
                      width: `${Math.min(pct, 100)}%`, height: "100%",
                      background: fill,
                      borderRadius: 3,
                      transition: "width 0.4s ease",
                    }} />
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 6 }}>
                    {b.meetingHours?.toFixed(1)}h meeting · {b.availableHours}h available
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Filters + anomaly list ── */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <span className="card-title-icon">🚨</span>
            Anomaly Details
            <span className="badge badge-muted">{filtered.length}</span>
            {counts.high > 0 && <span className="badge badge-red">● {counts.high} High</span>}
          </div>
          {/* Controls row */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {/* Severity filter */}
            <div className="filter-group" style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <span className="filter-label">Severity</span>
              <select
                value={sevFilter}
                onChange={(e) => setSevFilter(e.target.value)}
                style={{ fontSize: 12, padding: "6px 10px" }}
              >
                <option value="">All</option>
                <option value="high">🔴 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">⚪ Low</option>
              </select>
            </div>
            {/* Date range */}
            <div className="filter-group" style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <span className="filter-label">From</span>
              <input type="date" value={filters.from}
                onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
                style={{ fontSize: 12, padding: "6px 10px" }}
              />
            </div>
            <div className="filter-group" style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <span className="filter-label">To</span>
              <input type="date" value={filters.to}
                onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
                style={{ fontSize: 12, padding: "6px 10px" }}
              />
            </div>
            {(sevFilter || filters.from || filters.to) && (
              <button className="btn btn-ghost btn-sm" onClick={() => { setSevFilter(""); setFilters({ from: "", to: "" }); }}>
                ✕ Clear
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="empty-icon spinning" style={{ fontSize: 32 }}>⟳</div>
            <div className="empty-title">Scanning for anomalies…</div>
          </div>
        ) : all.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">✅</div>
            <div className="empty-title">All Clear — No Anomalies Detected</div>
            <div className="empty-sub">
              No budget overruns, attribution gaps, over-allocation, or low-priority mismatches found
              in the selected date window.
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <div className="empty-title">No {sevFilter} severity anomalies</div>
            <div className="empty-sub">Try a different severity filter.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 4 }}>
            {filtered.map((a, i) => {
              const cfg = SEV[a.severity] || SEV.low;
              const isOpen = expanded === i;
              return (
                <div
                  key={i}
                  style={{
                    borderRadius: 12,
                    border: `1px solid ${cfg.border}`,
                    background: cfg.bg,
                    overflow: "hidden",
                    transition: "box-shadow 0.2s",
                    cursor: "pointer",
                  }}
                  onClick={() => setExpanded(isOpen ? null : i)}
                >
                  {/* Header row */}
                  <div style={{
                    display: "flex", alignItems: "flex-start",
                    gap: 14, padding: "16px 20px",
                  }}>
                    {/* Severity dot */}
                    <div style={{
                      width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                      background: `${cfg.color}22`,
                      border: `2px solid ${cfg.color}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 16,
                    }}>
                      {cfg.emoji}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Title row */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                        <span style={{
                          padding: "2px 10px", borderRadius: 20, fontSize: 11,
                          fontWeight: 700, letterSpacing: "0.06em",
                          background: `${cfg.color}22`, color: cfg.color,
                          border: `1px solid ${cfg.border}`,
                        }}>
                          {cfg.label}
                        </span>
                        {a.rule && <RuleBadge rule={a.rule} />}
                        <span style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}>
                          {a.title}
                        </span>
                      </div>

                      {/* Detail text */}
                      <div style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.6 }}>
                        {a.detail}
                      </div>
                    </div>

                    {/* Expand chevron */}
                    <div style={{
                      fontSize: 18, color: "var(--text-3)", flexShrink: 0,
                      transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                      transition: "transform 0.2s",
                    }}>›</div>
                  </div>

                  {/* Expanded metrics */}
                  {isOpen && a.metrics && Object.keys(a.metrics).length > 0 && (
                    <div
                      style={{
                        borderTop: `1px solid ${cfg.border}`,
                        padding: "14px 20px 16px 70px",
                        display: "flex", flexWrap: "wrap", gap: 10,
                        animation: "fadeIn 0.15s ease",
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div style={{
                        fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
                        textTransform: "uppercase", color: "var(--text-3)",
                        width: "100%", marginBottom: 4,
                      }}>
                        📐 Metrics
                      </div>
                      {Object.entries(a.metrics).map(([k, v]) => (
                        <div
                          key={k}
                          style={{
                            background: "var(--surface-3)",
                            border: "1px solid var(--border)",
                            borderRadius: 8, padding: "8px 14px",
                            fontSize: 13,
                          }}
                        >
                          <span style={{ color: "var(--text-3)", marginRight: 6 }}>
                            {k.replace(/_/g, " ")}:
                          </span>
                          <strong style={{ color: "var(--text)" }}>
                            {typeof v === "number" ? (Number.isInteger(v) ? v : v.toFixed(2)) : String(v)}
                          </strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Rule legend */}
      <div className="card" style={{ marginTop: 16, padding: "14px 20px" }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)", marginBottom: 10 }}>
          📖 Rule Reference
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
          {[
            { rule: "A", icon: "💰", title: "Over Budget",         desc: "Project total cost exceeds its configured budget" },
            { rule: "B", icon: "👤", title: "Over-Allocated",      desc: "Employee's meeting hours > available work hours, or double-booked" },
            { rule: "C", icon: "🕐", title: "Attribution Gap",     desc: "Meetings without a project link — cost is invisible to leadership" },
            { rule: "D", icon: "📋", title: "Priority Mismatch",   desc: "Senior staff spending majority of time on low-priority projects" },
          ].map(({ rule, icon, title, desc }) => (
            <div
              key={rule}
              style={{
                background: "var(--surface-2)", border: "1px solid var(--border)",
                borderRadius: 10, padding: "12px 14px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                <span style={{ fontSize: 16 }}>{icon}</span>
                <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>
                  Rule {rule} — {title}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.5 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AnomalyStatCard({ label, value, emoji, type }) {
  return (
    <div className={`kpi-card ${type}`} style={{ cursor: "default" }}>
      <div className="kpi-header">
        <div className="kpi-icon-wrap">{emoji}</div>
      </div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
    </div>
  );
}
