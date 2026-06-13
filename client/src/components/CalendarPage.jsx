import { useEffect, useState, useMemo, useCallback } from "react";
import { getMeetings, getProjectsMeta, formatINR } from "../api.js";

/* ─── Constants ─────────────────────────────────────────── */
const HOUR_START  = 7;   // 7 AM
const HOUR_END    = 21;  // 9 PM
const TOTAL_HOURS = HOUR_END - HOUR_START;
const HOUR_PX     = 64;  // pixels per hour in week view
const TOTAL_PX    = TOTAL_HOURS * HOUR_PX;

const DAYS   = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const PROJECT_COLORS = [
  { bg: "rgba(99,102,241,0.85)",  border: "#6366f1", text: "#fff" },
  { bg: "rgba(16,185,129,0.85)",  border: "#10b981", text: "#fff" },
  { bg: "rgba(245,158,11,0.85)",  border: "#f59e0b", text: "#fff" },
  { bg: "rgba(239,68,68,0.85)",   border: "#ef4444", text: "#fff" },
  { bg: "rgba(139,92,246,0.85)",  border: "#8b5cf6", text: "#fff" },
  { bg: "rgba(6,182,212,0.85)",   border: "#06b6d4", text: "#fff" },
  { bg: "rgba(249,115,22,0.85)",  border: "#f97316", text: "#fff" },
  { bg: "rgba(236,72,153,0.85)",  border: "#ec4899", text: "#fff" },
];

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function formatTime(date) {
  return new Date(date).toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

function formatFullDate(date) {
  return new Date(date).toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

/* ─── Main Component ─────────────────────────────────────── */
export default function CalendarPage({ isAdmin = false }) {
  const [meetings, setMeetings]   = useState([]);
  const [projects, setProjects]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState(null);
  const [weekStart, setWeekStart] = useState(getWeekStart(new Date()));
  const [view, setView]           = useState("week"); // "week" | "month"
  const [selected, setSelected]   = useState(null);   // selected meeting

  const fetchData = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    setError(null);
    try {
      const [m, p] = await Promise.all([getMeetings(), getProjectsMeta()]);
      setMeetings(m.meetings || []);
      setProjects((p || []).map((x) => x.name));
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to load meetings. Is the server running?");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Build project → color map
  const projColor = useMemo(() => {
    const map = {};
    projects.forEach((p, i) => { map[p] = PROJECT_COLORS[i % PROJECT_COLORS.length]; });
    return map;
  }, [projects]);

  function colorFor(meeting) {
    const proj = meeting.attribution?.project;
    if (proj && projColor[proj]) return projColor[proj];
    if (meeting.attribution?.needsReview)
      return { bg: "rgba(245,158,11,0.8)", border: "#f59e0b", text: "#fff" };
    return { bg: "rgba(107,114,128,0.8)", border: "#6b7280", text: "#fff" };
  }

  // Week navigation
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekStart]);

  function prevWeek() { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); }
  function nextWeek() { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); }
  function goToday()  { setWeekStart(getWeekStart(new Date())); }

  // Meetings in current week
  const weekMeetings = useMemo(() => {
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7);
    return meetings.filter((m) => {
      const s = new Date(m.start);
      return s >= weekStart && s < weekEnd;
    });
  }, [meetings, weekStart]);

  // Group by day index (0=Sun..6=Sat)
  const byDay = useMemo(() => {
    const groups = Array.from({ length: 7 }, () => []);
    for (const m of weekMeetings) {
      const d = new Date(m.start).getDay();
      groups[d].push(m);
    }
    return groups;
  }, [weekMeetings]);

  const today = new Date();
  const monthLabel = `${MONTHS[weekDays[0].getMonth()]} ${weekDays[0].getFullYear()}`;
  const totalMins  = weekMeetings.reduce((s, m) => s + (m.durationMins || 0), 0);
  const totalHrsLabel = (totalMins / 60).toFixed(1);

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* ── Header controls ── */}
      <div className="card mb-6" style={{ padding: "12px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>

          {/* Left: Nav */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={prevWeek} title="Previous week">‹</button>
            <button className="btn btn-ghost btn-sm" onClick={goToday}>Today</button>
            <button className="btn btn-ghost btn-sm" onClick={nextWeek} title="Next week">›</button>
            <span style={{ fontWeight: 700, fontSize: 18, color: "var(--text)", marginLeft: 8 }}>
              {monthLabel}
            </span>
          </div>

          {/* Center: Meeting count */}
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span className="badge badge-blue">{weekMeetings.length} this week</span>
            {totalMins > 0 && (
              <span className="badge badge-muted">{totalHrsLabel}h total</span>
            )}
            <span className="badge badge-muted" style={{ opacity: 0.7 }}>
              {meetings.length} meetings total
            </span>
          </div>

          {/* Right: Refresh + View toggle */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => fetchData(true)}
              disabled={refreshing}
              title="Refresh meetings"
              style={{ display: "flex", alignItems: "center", gap: 5 }}
            >
              <span className={refreshing ? "spinning" : ""} style={{ display: "inline-block" }}>↻</span>
              {refreshing ? "Syncing…" : "Refresh"}
            </button>
            <div style={{ display: "flex", gap: 4, background: "var(--surface-2)", borderRadius: 8, padding: 3 }}>
              {["week", "month"].map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  style={{
                    padding: "5px 14px", borderRadius: 6, border: "none", cursor: "pointer",
                    fontWeight: 500, fontSize: 13, transition: "all 0.15s",
                    background: view === v ? "var(--primary)" : "transparent",
                    color: view === v ? "#fff" : "var(--text-3)",
                  }}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div style={{
          marginBottom: 12, padding: "12px 16px", borderRadius: 10,
          background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
          color: "#ef4444", fontSize: 13, display: "flex", alignItems: "center", gap: 8,
        }}>
          <span>⚠️</span>
          <span>{error}</span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => fetchData(true)}
            style={{ marginLeft: "auto" }}
          >Retry</button>
        </div>
      )}

      {loading ? (
        <div className="card" style={{ flex: 1 }}>
          <div className="empty-state">
            <div className="empty-icon spinning" style={{ fontSize: 32 }}>⟳</div>
            <div className="empty-title">Loading your calendar…</div>
          </div>
        </div>
      ) : meetings.length === 0 ? (
        <div className="card" style={{ flex: 1 }}>
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <div className="empty-title">No meetings ingested yet</div>
            <div className="empty-sub">
              Go to <strong>Data &amp; Setup</strong> and run the ingestion pipeline first,
              or click <strong>"Load sample data"</strong> for a quick demo.
            </div>
          </div>
        </div>
      ) : view === "week" ? (
        <WeekView
          weekDays={weekDays}
          byDay={byDay}
          today={today}
          colorFor={colorFor}
          onSelect={setSelected}
          selected={selected}
          weekMeetings={weekMeetings}
          onPrevWeek={prevWeek}
          onNextWeek={nextWeek}
        />
      ) : (
        <MonthView
          weekStart={weekStart}
          meetings={meetings}
          today={today}
          colorFor={colorFor}
          onSelect={setSelected}
          onWeekChange={(d) => { setWeekStart(getWeekStart(d)); setView("week"); }}
        />
      )}

      {/* ── Project Legend ── */}
      <div className="card" style={{ marginTop: 12, padding: "12px 20px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginRight: 4 }}>
            Projects:
          </span>
          {projects.map((p, i) => {
            const c = PROJECT_COLORS[i % PROJECT_COLORS.length];
            return (
              <div key={p} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: c.border, display: "inline-block" }} />
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>{p}</span>
              </div>
            );
          })}
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: "#f59e0b", display: "inline-block" }} />
            <span style={{ fontSize: 12, color: "var(--text-2)" }}>Needs Review</span>
          </div>
        </div>
      </div>

      {/* ── Meeting Detail Popover ── */}
      {selected && (
        <MeetingPopover
          meeting={selected}
          colorFor={colorFor}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

/* ─── Week View ──────────────────────────────────────────── */
function WeekView({ weekDays, byDay, today, colorFor, onSelect, selected, weekMeetings = [], onPrevWeek, onNextWeek }) {
  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => HOUR_START + i);
  const nowMins = today.getHours() * 60 + today.getMinutes();
  const nowTop  = ((nowMins - HOUR_START * 60) / (TOTAL_HOURS * 60)) * TOTAL_PX;
  const hasNoMeetingsThisWeek = weekMeetings.length === 0;

  return (
    <div className="card" style={{ overflow: "hidden", flex: 1, display: "flex", flexDirection: "column" }}>
      {/* Empty week overlay */}
      {hasNoMeetingsThisWeek && (
        <div style={{
          padding: "14px 20px",
          background: "rgba(99,102,241,0.06)",
          borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 8,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-3)" }}>
            <span>📭</span>
            <span>No meetings this week. Your meetings may be in a different week.</span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {onPrevWeek && (
              <button className="btn btn-ghost btn-sm" onClick={onPrevWeek}>‹ Prev week</button>
            )}
            {onNextWeek && (
              <button className="btn btn-ghost btn-sm" onClick={onNextWeek}>Next week ›</button>
            )}
          </div>
        </div>
      )}
      {/* Day headers */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "56px repeat(7, 1fr)",
        borderBottom: "1px solid var(--border)",
        background: "var(--surface-2)",
      }}>
        <div style={{ padding: "10px 8px" }} />
        {weekDays.map((day, i) => {
          const isToday = isSameDay(day, today);
          return (
            <div key={i} style={{
              padding: "10px 4px", textAlign: "center",
              borderLeft: "1px solid var(--border)",
            }}>
              <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                {DAYS[day.getDay()]}
              </div>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: isToday ? "var(--primary)" : "transparent",
                color: isToday ? "#fff" : "var(--text)",
                fontWeight: isToday ? 700 : 500,
                fontSize: 14,
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto",
              }}>
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Scrollable time grid */}
      <div style={{ overflowY: "auto", flex: 1, position: "relative" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "56px repeat(7, 1fr)",
          height: TOTAL_PX,
          position: "relative",
        }}>
          {/* Time labels */}
          <div style={{ position: "relative" }}>
            {hours.map((h) => (
              <div key={h} style={{
                position: "absolute",
                top: (h - HOUR_START) * HOUR_PX - 8,
                right: 8,
                fontSize: 10,
                color: "var(--text-3)",
                whiteSpace: "nowrap",
              }}>
                {h % 12 === 0 ? 12 : h % 12}{h < 12 ? "am" : "pm"}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((day, di) => {
            const dayMeetings = byDay[day.getDay()] || [];
            const isToday     = isSameDay(day, today);

            return (
              <div key={di} style={{
                position: "relative",
                borderLeft: "1px solid var(--border)",
                background: isToday ? "rgba(99,102,241,0.02)" : "transparent",
              }}>
                {/* Hour grid lines */}
                {hours.map((h) => (
                  <div key={h} style={{
                    position: "absolute",
                    top: (h - HOUR_START) * HOUR_PX,
                    left: 0, right: 0,
                    height: 1,
                    background: "var(--border)",
                    opacity: 0.5,
                  }} />
                ))}

                {/* Now line */}
                {isToday && nowTop >= 0 && nowTop <= TOTAL_PX && (
                  <div style={{
                    position: "absolute",
                    top: nowTop,
                    left: 0, right: 0,
                    height: 2,
                    background: "#ef4444",
                    zIndex: 10,
                  }}>
                    <div style={{
                      position: "absolute", left: -4, top: -4,
                      width: 8, height: 8, borderRadius: "50%",
                      background: "#ef4444",
                    }} />
                  </div>
                )}

                {/* Meeting events */}
                {dayMeetings.map((m) => {
                  const start = new Date(m.start);
                  const startMins = start.getHours() * 60 + start.getMinutes();
                  const topPct  = ((startMins - HOUR_START * 60) / (TOTAL_HOURS * 60)) * TOTAL_PX;
                  const heightPx = Math.max(20, (m.durationMins / 60) * HOUR_PX - 2);
                  const c = colorFor(m);
                  const isSelected = selected?.googleEventId === m.googleEventId;

                  return (
                    <div
                      key={m.googleEventId}
                      onClick={() => onSelect(isSelected ? null : m)}
                      style={{
                        position: "absolute",
                        top: topPct + 1,
                        left: 2, right: 2,
                        height: heightPx,
                        background: c.bg,
                        borderLeft: `3px solid ${c.border}`,
                        borderRadius: "0 6px 6px 0",
                        padding: "3px 6px",
                        cursor: "pointer",
                        overflow: "hidden",
                        zIndex: isSelected ? 20 : 5,
                        boxShadow: isSelected ? `0 0 0 2px ${c.border}` : "0 1px 4px rgba(0,0,0,0.3)",
                        transition: "box-shadow 0.15s, transform 0.1s",
                        transform: isSelected ? "scale(1.01)" : "scale(1)",
                      }}
                    >
                      <div style={{
                        fontSize: 11, fontWeight: 600,
                        color: c.text,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: heightPx > 40 ? "normal" : "nowrap",
                        lineHeight: 1.3,
                      }}>
                        {m.title}
                      </div>
                      {heightPx > 32 && (
                        <div style={{ fontSize: 10, color: c.text, opacity: 0.85, marginTop: 2 }}>
                          {formatTime(m.start)}
                          {m.durationMins && ` · ${m.durationMins}m`}
                        </div>
                      )}
                      {heightPx > 50 && m.attribution?.project && (
                        <div style={{ fontSize: 10, color: c.text, opacity: 0.75, marginTop: 1, fontStyle: "italic" }}>
                          {m.attribution.project}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── Month View ─────────────────────────────────────────── */
function MonthView({ weekStart, meetings, today, colorFor, onSelect, onWeekChange }) {
  // Get the month of the week's first day
  const monthDate = new Date(weekStart);
  const year  = monthDate.getFullYear();
  const month = monthDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const startPad = firstDay.getDay(); // offset from Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  function meetingsOnDay(date) {
    if (!date) return [];
    return meetings.filter((m) => isSameDay(new Date(m.start), date));
  }

  return (
    <div className="card" style={{ overflow: "hidden", flex: 1 }}>
      {/* Day headers */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(7, 1fr)",
        borderBottom: "1px solid var(--border)",
        background: "var(--surface-2)",
      }}>
        {DAYS.map((d) => (
          <div key={d} style={{
            padding: "10px 0", textAlign: "center",
            fontSize: 11, fontWeight: 700,
            color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em",
          }}>
            {d}
          </div>
        ))}
      </div>

      {/* Month grid */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{
            display: "grid", gridTemplateColumns: "repeat(7, 1fr)",
            borderBottom: wi < weeks.length - 1 ? "1px solid var(--border)" : "none",
            minHeight: 90,
          }}>
            {week.map((date, di) => {
              const isToday = date && isSameDay(date, today);
              const dayMeetings = meetingsOnDay(date);

              return (
                <div
                  key={di}
                  onClick={() => date && onWeekChange(date)}
                  style={{
                    borderLeft: di > 0 ? "1px solid var(--border)" : "none",
                    padding: "6px 8px",
                    cursor: date ? "pointer" : "default",
                    background: isToday ? "rgba(99,102,241,0.04)" : "transparent",
                    transition: "background 0.15s",
                    minHeight: 90,
                  }}
                  onMouseEnter={(e) => { if (date) e.currentTarget.style.background = "rgba(99,130,255,0.05)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = isToday ? "rgba(99,102,241,0.04)" : "transparent"; }}
                >
                  {date && (
                    <>
                      <div style={{
                        width: 26, height: 26, borderRadius: "50%",
                        background: isToday ? "var(--primary)" : "transparent",
                        color: isToday ? "#fff" : "var(--text-2)",
                        fontWeight: isToday ? 700 : 400,
                        fontSize: 13,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        marginBottom: 4,
                      }}>
                        {date.getDate()}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {dayMeetings.slice(0, 3).map((m) => {
                          const c = colorFor(m);
                          return (
                            <div
                              key={m.googleEventId}
                              onClick={(e) => { e.stopPropagation(); onSelect(m); }}
                              style={{
                                background: c.bg,
                                borderLeft: `2px solid ${c.border}`,
                                borderRadius: "0 3px 3px 0",
                                padding: "1px 5px",
                                fontSize: 10, fontWeight: 500,
                                color: c.text,
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                cursor: "pointer",
                              }}
                            >
                              {m.title}
                            </div>
                          );
                        })}
                        {dayMeetings.length > 3 && (
                          <div style={{ fontSize: 10, color: "var(--text-3)", paddingLeft: 4 }}>
                            +{dayMeetings.length - 3} more
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Meeting Detail Popover ─────────────────────────────── */
function MeetingPopover({ meeting: m, colorFor, onClose }) {
  const c = colorFor(m);
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(0,0,0,0.4)",
        }}
      />
      {/* Panel */}
      <div style={{
        position: "fixed",
        top: "50%", left: "50%",
        transform: "translate(-50%,-50%)",
        zIndex: 1001,
        width: 440,
        maxWidth: "90vw",
        maxHeight: "80vh",
        overflowY: "auto",
        background: "var(--surface)",
        borderRadius: 16,
        border: `1px solid ${c.border}`,
        boxShadow: `0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px ${c.border}40`,
        animation: "fadeIn 0.15s ease",
      }}>
        {/* Header stripe */}
        <div style={{
          padding: "18px 20px 14px",
          borderBottom: "1px solid var(--border)",
          background: `${c.bg.replace("0.85", "0.15")}`,
          borderRadius: "16px 16px 0 0",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)", marginBottom: 6, lineHeight: 1.3 }}>
                {m.title}
              </div>
              {m.attribution?.project && (
                <span style={{
                  padding: "3px 10px", borderRadius: 20, fontSize: 11,
                  background: `${c.border}22`, color: c.border,
                  border: `1px solid ${c.border}55`, fontWeight: 600,
                }}>
                  {m.attribution.project}
                </span>
              )}
              {m.attribution?.needsReview && (
                <span className="badge badge-amber" style={{ marginLeft: 6 }}>⚠ Needs Review</span>
              )}
            </div>
            <button
              onClick={onClose}
              style={{
                background: "var(--surface-2)", border: "none", cursor: "pointer",
                color: "var(--text-3)", borderRadius: 8,
                width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, flexShrink: 0,
              }}
            >✕</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Date / time / duration */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <InfoRow icon="🗓" label="Date"     value={formatFullDate(m.start)} />
            <InfoRow icon="⏰" label="Time"     value={`${formatTime(m.start)} – ${formatTime(m.end || new Date(new Date(m.start).getTime() + m.durationMins * 60000))}`} />
            <InfoRow icon="⏱" label="Duration" value={m.durationMins < 60 ? `${m.durationMins} min` : `${(m.durationMins/60).toFixed(1)} hours`} />
            {m.recurrence && <InfoRow icon="🔁" label="Recurring" value="Yes (recurring event)" />}
          </div>

          {/* Attendees */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
              👥 Attendees ({(m.attendees || []).length})
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {(m.attendees || []).filter((a) => !a.resource).map((a) => (
                <span
                  key={a.email}
                  style={{
                    fontSize: 12, padding: "3px 10px", borderRadius: 20,
                    background: a.responseStatus === "declined" ? "var(--surface-3)" : "var(--surface-2)",
                    border: "1px solid var(--border)",
                    color: a.responseStatus === "declined" ? "var(--text-3)" : "var(--text-2)",
                    textDecoration: a.responseStatus === "declined" ? "line-through" : "none",
                    opacity: a.responseStatus === "declined" ? 0.5 : 1,
                  }}
                  title={a.email}
                >
                  {a.displayName || a.email.split("@")[0]}
                  {a.organizer && " ★"}
                </span>
              ))}
            </div>
          </div>

          {/* Attribution */}
          {m.attribution?.method && m.attribution.method !== "pending" && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                📁 Attribution
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <span className="badge badge-muted" style={{ textTransform: "capitalize" }}>
                  Method: {m.attribution.method}
                </span>
                {m.attribution.confidence != null && (
                  <span className="badge badge-muted">
                    Confidence: {Math.round(m.attribution.confidence * 100)}%
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13 }}>
      <span style={{ flexShrink: 0 }}>{icon}</span>
      <span style={{ color: "var(--text-3)", minWidth: 60 }}>{label}</span>
      <span style={{ color: "var(--text-2)", fontWeight: 500 }}>{value}</span>
    </div>
  );
}
