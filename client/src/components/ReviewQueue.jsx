import { useEffect, useState } from "react";
import { getReviewQueue, getProjectsMeta, correctAttribution, getEval } from "../api.js";

export default function ReviewQueue({ onCountChange }) {
  const [queue, setQueue]       = useState([]);
  const [threshold, setThreshold] = useState(0.6);
  const [projects, setProjects] = useState([]);
  const [evalRes, setEvalRes]   = useState(null);
  const [saving, setSaving]     = useState(null);

  useEffect(() => {
    reload();
    getProjectsMeta().then(setProjects).catch(() => {});
  }, []); // eslint-disable-line

  async function reload() {
    const [q, e] = await Promise.all([
      getReviewQueue(),
      getEval().catch(() => null),
    ]);
    setQueue(q.meetings || []);
    setThreshold(q.threshold);
    setEvalRes(e);
    onCountChange?.((q.meetings || []).length);
  }

  async function save(googleEventId, project) {
    setSaving(googleEventId);
    try {
      await correctAttribution(googleEventId, project || null);
      await reload();
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="fade-in">
      {/* ── Stats header ── */}
      <div className="section-grid mb-6" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
        <StatCard
          icon="📬"
          label="Pending Reviews"
          value={queue.length}
          type={queue.length > 0 ? "warn" : "success"}
        />
        <StatCard
          icon="🎯"
          label="Attribution Accuracy"
          value={evalRes?.accuracyPct ?? "—"}
          type={evalRes?.meetsTarget ? "success" : "warn"}
        />
        <StatCard
          icon="📏"
          label="Confidence Threshold"
          value={`${Math.round(threshold * 100)}%`}
          type=""
        />
      </div>

      {/* ── Info card ── */}
      <div className="card mb-6" style={{ borderLeft: "3px solid var(--indigo)", background: "rgba(129,140,248,0.06)" }}>
        <div className="flex items-center gap-3">
          <span style={{ fontSize: 24 }}>🤖</span>
          <div>
            <div style={{ fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
              AI Review Queue
            </div>
            <div className="text-sm text-muted">
              Meetings flagged by Llama — confidence below {threshold} or no clear project mapping.
              Confirming a project teaches the system; it won't be overwritten on re-runs.
            </div>
          </div>
        </div>
      </div>

      {/* ── Queue table ── */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <span className="card-title-icon">📝</span>
            Flagged Meetings
            <span className="badge badge-amber">{queue.length}</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={reload}>
            ↻ Refresh
          </button>
        </div>

        {queue.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🎉</div>
            <div className="empty-title">Nothing to review!</div>
            <div className="empty-sub">
              Every meeting is attributed with confidence ≥ {threshold}.<br />
              The AI is doing great work.
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Meeting</th>
                  <th>Date</th>
                  <th>Current Attribution</th>
                  <th>Confidence</th>
                  <th>Set Project</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((m) => (
                  <MeetingRow
                    key={m.googleEventId}
                    meeting={m}
                    projects={projects}
                    saving={saving === m.googleEventId}
                    onSave={(p) => save(m.googleEventId, p)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Stat mini-card ─────────────────────────────────────── */
function StatCard({ icon, label, value, type }) {
  const typeClass = type ? `kpi-card ${type}` : "kpi-card";
  return (
    <div className={typeClass}>
      <div className="kpi-header">
        <div className="kpi-icon-wrap">{icon}</div>
      </div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
    </div>
  );
}

/* ── Meeting row ────────────────────────────────────────── */
function MeetingRow({ meeting: m, projects, saving, onSave }) {
  return (
    <tr>
      <td style={{ maxWidth: 300 }}>
        <div style={{ fontWeight: 600, color: "var(--text)", marginBottom: 3 }}>{m.title}</div>
        {m.description && (
          <div className="text-xs text-muted">
            {m.description.slice(0, 80)}{m.description.length > 80 ? "…" : ""}
          </div>
        )}
      </td>
      <td className="nowrap text-muted">
        {new Date(m.start).toLocaleDateString("en-IN", {
          day: "numeric", month: "short", year: "numeric",
        })}
      </td>
      <td>
        {m.attribution?.project ? (
          <span className="badge badge-blue">{m.attribution.project}</span>
        ) : (
          <span className="badge badge-muted">— none —</span>
        )}
      </td>
      <td>
        <ConfBar value={m.attribution?.confidence ?? 0} />
      </td>
      <td>
        <ProjectPicker
          projects={projects}
          current={m.attribution?.project || ""}
          disabled={saving}
          onSave={onSave}
        />
      </td>
    </tr>
  );
}

/* ── Project picker ─────────────────────────────────────── */
function ProjectPicker({ projects, current, onSave, disabled }) {
  const [val, setVal] = useState(current);

  return (
    <div className="flex items-center gap-2">
      <select
        value={val}
        onChange={(e) => setVal(e.target.value)}
        disabled={disabled}
        style={{ minWidth: 160 }}
      >
        <option value="">— none —</option>
        {projects.map((p) => (
          <option key={p.name} value={p.name}>{p.name}</option>
        ))}
      </select>
      <button
        className={`btn btn-sm ${val !== current ? "btn-primary" : ""}`}
        disabled={disabled || val === current}
        onClick={() => onSave(val)}
      >
        {disabled ? <span className="spinning">⟳</span> : "Confirm"}
      </button>
    </div>
  );
}

/* ── Confidence bar ─────────────────────────────────────── */
function ConfBar({ value }) {
  const pct   = Math.round(value * 100);
  const color = value >= 0.6 ? "#10b981" : value > 0 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex items-center gap-2">
      <div className="confbar" title={`${pct}%`}>
        <div className="confbar-fill" style={{ width: `${pct}%`, background: color }} />
        <span>{pct}%</span>
      </div>
    </div>
  );
}
