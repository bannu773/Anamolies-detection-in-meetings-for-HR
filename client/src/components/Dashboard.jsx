import { useEffect, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
  PieChart, Pie, Legend, CartesianGrid,
} from "recharts";
import { getProjectCosts, getTeams, getEval, getReviewQueue, getAnomalies, formatINR } from "../api.js";
import { CHART_COLORS, PRIORITY_COLOR } from "../theme.js";
import { SkeletonKpiGrid, SkeletonTable } from "./Skeleton.jsx";
import { exportProjectsCsv } from "../utils/exportCsv.js";

const tooltipStyle = {
  background: "#111827",
  border: "1px solid rgba(99,130,255,0.2)",
  borderRadius: 10,
  fontSize: 12,
  color: "#e2e8f0",
  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
};
const tooltipLabelStyle = { color: "#a8b4d0", marginBottom: 4, fontWeight: 600 };
const tooltipItemStyle = { color: "#e2e8f0" };

const SEV_CONFIG = {
  high: { emoji: "🔴", label: "HIGH", badgeCls: "badge badge-red" },
  medium: { emoji: "🟡", label: "MED", badgeCls: "badge badge-amber" },
  low: { emoji: "⚪", label: "LOW", badgeCls: "badge badge-muted" },
};

export default function Dashboard({ isAdmin = false, onReviewCountChange }) {
  const [data, setData] = useState(null);
  const [teams, setTeams] = useState([]);
  const [evalRes, setEvalRes] = useState(null);
  const [reviewCount, setReviewCount] = useState(0);
  const [anomalies, setAnomalies] = useState(null);
  const [filters, setFilters] = useState({ team: "", from: "", to: "" });
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  useEffect(() => {
    getTeams().then(setTeams).catch(() => { });
    getEval().then(setEvalRes).catch(() => { });
    getReviewQueue()
      .then((r) => {
        setReviewCount(r.count);
        onReviewCountChange?.(r.count);
      })
      .catch(() => { });
  }, []); // eslint-disable-line

  useEffect(() => { load(); }, [filters]); // eslint-disable-line

  async function load() {
    setLoading(true);
    try {
      const res = await getProjectCosts({
        team: filters.team || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
      });
      setData(res);
      setInitialLoad(false);
      if (selected && !res.projects.find((p) => p.project === selected))
        setSelected(null);
      getAnomalies({ from: filters.from || undefined, to: filters.to || undefined })
        .then(setAnomalies)
        .catch(() => { });
    } finally {
      setLoading(false);
    }
  }

  const named = (data?.projects || []).filter((p) => p.project);
  const chartData = named.map((p, i) => ({
    name: p.project,
    cost: p.totalCost,
    over: p.overBudget,
    priority: p.priority,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));
  const selectedRow = named.find((p) => p.project === selected);
  const totalCost = data?.totals?.totalCost ?? 0;

  return (
    <div className="fade-in">
      {/* ── Filter bar ── */}
      <div className="card mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="filter-row">
            <div className="filter-group">
              <span className="filter-label">Team</span>
              <select
                value={filters.team}
                onChange={(e) => setFilters({ ...filters, team: e.target.value })}
              >
                <option value="">All Teams</option>
                {teams.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="filter-group">
              <span className="filter-label">From</span>
              <input
                type="date"
                value={filters.from}
                onChange={(e) => setFilters({ ...filters, from: e.target.value })}
              />
            </div>
            <div className="filter-group">
              <span className="filter-label">To</span>
              <input
                type="date"
                value={filters.to}
                onChange={(e) => setFilters({ ...filters, to: e.target.value })}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {loading && (
              <span className="text-sm text-muted flex items-center gap-2">
                <span className="spinning">⟳</span> Updating…
              </span>
            )}
            {(filters.team || filters.from || filters.to) && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setFilters({ team: "", from: "", to: "" })}
              >
                ✕ Clear filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      {initialLoad ? (
        <div className="mb-6"><SkeletonKpiGrid count={6} /></div>
      ) : (
        <div className="kpi-grid" style={{ marginBottom: 24 }}>
          <KpiCard
            id="kpi-total-cost"
            icon="💰"
            label="Total HR Cost"
            value={formatINR(totalCost)}
            type="accent"
            sub={`${data?.totals?.meetings ?? 0} meetings tracked`}
          />
          <KpiCard
            id="kpi-projects"
            icon="📁"
            label="Active Projects"
            value={data?.totals?.projects ?? "—"}
            sub="with cost attribution"
          />
          <KpiCard
            id="kpi-meetings"
            icon="📅"
            label="Meetings Ingested"
            value={data?.totals?.meetings ?? "—"}
            sub={`${data?.totals?.externalAttendees ?? 0} external attendees`}
          />
          <KpiCard
            id="kpi-accuracy"
            icon="🎯"
            label="Attribution Accuracy"
            value={evalRes ? evalRes.accuracyPct : "—"}
            type={evalRes?.meetsTarget ? "success" : "warn"}
            sub={evalRes?.meetsTarget ? "Target ≥85% met ✓" : "Below target threshold"}
          />
          <KpiCard
            id="kpi-review"
            icon="⚠️"
            label="Needs Review"
            value={reviewCount}
            type={reviewCount > 0 ? "warn" : "success"}
            sub={reviewCount > 0 ? "Meetings awaiting human review" : "All meetings attributed ✓"}
          />
          <KpiCard
            id="kpi-unattributed"
            icon="🔍"
            label="Unattributed Cost"
            value={data?.projects
              ? formatINR(data.projects.find((p) => !p.project)?.totalCost ?? 0)
              : "—"}
            type={data?.projects?.find((p) => !p.project)?.totalCost > 0 ? "danger" : "success"}
            sub="Meetings without project link"
          />
        </div>
      )}

      {/* ── Privacy notice (k-anonymity) ── */}
      {/* Suppression removed — all team/role data shown without restrictions */}

      {/* ── Anomaly Panel ── */}
      <AnomalyPanel anomalies={anomalies} />

      {/* ── Charts Row ── */}
      <div className="charts-grid mb-6">
        {/* Bar chart */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <span className="card-title-icon">📊</span>
              HR Cost per Project
            </div>
            <span className="text-xs text-muted">Click bar to drill down</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 20, left: 8 }}>
              <CartesianGrid vertical={false} stroke="rgba(99,130,255,0.06)" />
              <XAxis
                dataKey="name"
                tick={{ fill: "#6b7a99", fontSize: 11 }}
                interval={0}
                angle={-12}
                textAnchor="end"
                height={55}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#6b7a99", fontSize: 11 }}
                tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(v) => [formatINR(v), "Cost"]}
                contentStyle={tooltipStyle}
                labelStyle={tooltipLabelStyle}
                itemStyle={tooltipItemStyle}
                cursor={{ fill: "rgba(91,140,255,0.06)", radius: 6 }}
              />
              <Bar
                dataKey="cost"
                radius={[6, 6, 0, 0]}
                onClick={(d) => setSelected(selected === d.name ? null : d.name)}
                cursor="pointer"
              >
                {chartData.map((d) => (
                  <Cell
                    key={d.name}
                    fill={d.over ? "#ef4444" : d.color}
                    opacity={selected && selected !== d.name ? 0.3 : 1}
                    style={{ filter: selected === d.name ? `drop-shadow(0 0 8px ${d.color})` : "none" }}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <span className="card-title-icon">🥧</span>
              Cost Share
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="cost"
                nameKey="name"
                cx="50%"
                cy="45%"
                outerRadius={95}
                innerRadius={40}
                paddingAngle={3}
                onClick={(d) => setSelected(selected === d.name ? null : d.name)}
                cursor="pointer"
              >
                {chartData.map((d, i) => (
                  <Cell
                    key={d.name}
                    fill={CHART_COLORS[i % CHART_COLORS.length]}
                    opacity={selected && selected !== d.name ? 0.3 : 1}
                    stroke="transparent"
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(v) => [formatINR(v), "Cost"]}
                contentStyle={tooltipStyle}
                labelStyle={tooltipLabelStyle}
                itemStyle={tooltipItemStyle}
              />
              <Legend
                wrapperStyle={{ fontSize: 12, color: "#6b7a99", paddingTop: 8 }}
                iconType="circle"
                iconSize={8}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Drill-down panel ── */}
      {selectedRow && (
        <div className="card drilldown-panel mb-6">
          <div className="card-header">
            <div className="card-title">
              <span className="card-title-icon">🔬</span>
              Drill-down · {selectedRow.project}
              <span className="badge badge-blue" style={{ marginLeft: 8 }}>
                {formatINR(selectedRow.totalCost)}
              </span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>
              ✕ Close
            </button>
          </div>
          <div className="section-grid">
            <Breakdown title="By Team" map={selectedRow.byTeam} />
            <Breakdown title="By Role" map={selectedRow.byRole} />
          </div>
        </div>
      )}

      {/* ── Project table ── */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <span className="card-title-icon">📋</span>
            Project Breakdown
          </div>
          <div className="flex items-center gap-2">
            <span className="badge badge-muted">{named.length} projects</span>
            {named.length > 0 && (
              <button
                className="btn btn-sm"
                title="Download project costs as CSV"
                onClick={() => exportProjectsCsv(named)}
              >
                ⬇ Export CSV
              </button>
            )}
          </div>
        </div>

        {initialLoad ? (
          <SkeletonTable rows={4} cols={8} />
        ) : named.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <div className="empty-title">No project data yet</div>
            <div className="empty-sub">
              Go to Data &amp; Setup, load sample data or connect your calendar, then run AI attribution.
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Priority</th>
                  <th>Total Cost</th>
                  <th>Budget</th>
                  <th>Utilization</th>
                  <th>Meetings</th>
                  <th>Person-hrs</th>
                  <th>Review</th>
                </tr>
              </thead>
              <tbody>
                {named.map((p, i) => {
                  const util = p.budgetUtilization != null ? Math.round(p.budgetUtilization * 100) : null;
                  const barColor = util > 100 ? "#ef4444" : util > 80 ? "#f59e0b" : "#10b981";
                  return (
                    <tr
                      key={p.project}
                      className={selected === p.project ? "row-selected" : ""}
                      onClick={() => setSelected(selected === p.project ? null : p.project)}
                      style={{ cursor: "pointer" }}
                    >
                      <td>
                        <div className="flex items-center gap-2">
                          <span
                            style={{
                              width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                              background: CHART_COLORS[i % CHART_COLORS.length],
                            }}
                          />
                          <strong>{p.project}</strong>
                        </div>
                      </td>
                      <td>
                        <span className={`badge priority-${p.priority}`}>
                          {p.priority?.toUpperCase() ?? "—"}
                        </span>
                      </td>
                      <td><strong>{formatINR(p.totalCost)}</strong></td>
                      <td className="text-muted">{p.budget ? formatINR(p.budget) : "—"}</td>
                      <td style={{ minWidth: 130 }}>
                        {util != null ? (
                          <div className="util-bar-wrap">
                            <div className="util-bar">
                              <div
                                className="util-fill"
                                style={{ width: `${Math.min(util, 100)}%`, background: barColor }}
                              />
                            </div>
                            <span className="util-label" style={{ color: barColor }}>{util}%</span>
                          </div>
                        ) : "—"}
                      </td>
                      <td className="text-muted">{p.meetingCount}</td>
                      <td className="text-muted">{p.personHours}h</td>
                      <td>
                        {p.needsReviewCount > 0 ? (
                          <span className="badge badge-amber">⚠ {p.needsReviewCount}</span>
                        ) : (
                          <span className="badge badge-green">✓</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Admin notice — cost drill-down from setup is gated */}
      {!isAdmin && (
        <div
          className="text-xs text-muted"
          style={{ textAlign: "center", marginTop: 12, display: "flex", gap: 6, justifyContent: "center" }}
        >
          <span>🔒</span>
          Per-attendee cost drill-down is admin-only. Individual costs reveal salary information.
        </div>
      )}
    </div>
  );
}

/* ── Privacy Notice (k-anonymity) ──────────────────────────── */
function PrivacyNotice({ suppressed }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className="card mb-6"
      style={{
        borderColor: "rgba(129,140,248,0.3)",
        background: "rgba(129,140,248,0.05)",
        padding: "14px 18px",
      }}
    >
      <div className="flex items-center gap-3">
        <span style={{ fontSize: 18 }}>🔒</span>
        <div className="flex-1">
          <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)", marginBottom: 3 }}>
            Privacy Protection Active
          </div>
          <div className="text-xs text-muted">
            {suppressed.length} group{suppressed.length !== 1 ? "s" : ""} suppressed — fewer than 3 people in the group.
            {" "}<button
              className="btn btn-ghost btn-sm"
              style={{ padding: "0 4px", fontSize: 11, display: "inline" }}
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? "Hide details ▴" : "Show details ▾"}
            </button>
          </div>
          {expanded && (
            <ul style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 3 }}>
              {suppressed.map((s, i) => (
                <li key={i} className="text-xs text-muted" style={{ display: "flex", gap: 6 }}>
                  <span style={{ color: "var(--indigo)" }}>○</span>
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Anomaly Panel ────────────────────────────────────────── */
function AnomalyPanel({ anomalies }) {
  const [collapsed, setCollapsed] = useState(false);
  if (!anomalies) return null;
  const list = anomalies.anomalies || [];
  const busiest = anomalies.insights?.busiestPeople || [];
  const hasHigh = anomalies.counts?.high > 0;

  return (
    <div className="card mb-6">
      <div className="card-header">
        <div className="card-title">
          <span className="card-title-icon">🚨</span>
          Anomaly Detection
          <span className="badge badge-muted">{list.length}</span>
          {hasHigh && <span className="badge badge-red">● {anomalies.counts.high} High</span>}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? "▸ Expand" : "▾ Collapse"}
        </button>
      </div>

      {!collapsed && (
        <>
          {list.length === 0 ? (
            <div className="flex items-center gap-3" style={{ padding: "8px 0" }}>
              <span style={{ fontSize: 24 }}>✅</span>
              <div>
                <div style={{ fontWeight: 600, color: "var(--success)" }}>All clear</div>
                <div className="text-sm text-muted">No anomalies detected in the selected window.</div>
              </div>
            </div>
          ) : (
            <div className="anomaly-grid">
              {list.map((a, i) => {
                const cfg = SEV_CONFIG[a.severity] || SEV_CONFIG.low;
                return (
                  <div key={i} className={`anomaly-item sev-${a.severity}`}>
                    <div className="anomaly-sev-dot">{cfg.emoji}</div>
                    <div className="anomaly-body">
                      <div className="flex items-center gap-2 mb-2" style={{ flexWrap: "wrap" }}>
                        <span className={cfg.badgeCls}>{cfg.label}</span>
                        <div className="anomaly-title">{a.title}</div>
                      </div>
                      <div className="anomaly-detail">{a.detail}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {busiest.length > 0 && (
            <div className="load-chips">
              <span className="text-xs text-muted" style={{ alignSelf: "center" }}>
                📊 Meeting load (% of work hours):
              </span>
              {busiest.map((b) => (
                <span key={b.email} className="load-chip">
                  {b.name}
                  <span className="load-chip-pct">{b.loadPct}%</span>
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Breakdown bar chart ────────────────────────────────────── */
function Breakdown({ title, map }) {
  const visible = Object.entries(map || {})
    .map(([name, cost]) => ({ name, cost }))
    .sort((a, b) => b.cost - a.cost);

  return (
    <div>
      <div className="card-title" style={{ marginBottom: 12 }}>{title}</div>

      {visible.length === 0 ? (
        <div className="text-sm text-muted">No data available.</div>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(160, visible.length * 44)}>
          <BarChart data={visible} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
            <CartesianGrid horizontal={false} stroke="rgba(99,130,255,0.06)" />
            <XAxis
              type="number"
              tick={{ fill: "#6b7a99", fontSize: 11 }}
              tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: "#a8b4d0", fontSize: 12 }}
              width={110}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(v) => [formatINR(v), "Cost"]}
              contentStyle={tooltipStyle}
              labelStyle={tooltipLabelStyle}
              itemStyle={tooltipItemStyle}
              cursor={{ fill: "rgba(91,140,255,0.06)" }}
            />
            <Bar dataKey="cost" radius={[0, 6, 6, 0]}>
              {visible.map((d, i) => (
                <Cell key={d.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}


/* ── KPI Card ─────────────────────────────────────────────── */
function KpiCard({ id, icon, label, value, type = "", sub }) {
  return (
    <div id={id} className={`kpi-card ${type}`}>
      <div className="kpi-header">
        <div className="kpi-icon-wrap">{icon}</div>
      </div>
      <div className="kpi-value">{value ?? "—"}</div>
      <div className="kpi-label">{label}</div>
      {sub && <div className="text-xs text-muted" style={{ marginTop: 6 }}>{sub}</div>}
    </div>
  );
}
