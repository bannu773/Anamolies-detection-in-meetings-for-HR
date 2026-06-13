import { useEffect, useState } from "react";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { getHealth, getAnomalies } from "./api.js";
import { getSessionUser } from "./auth.js";
import Dashboard from "./components/Dashboard.jsx";
import ReviewQueue from "./components/ReviewQueue.jsx";
import SetupPanel from "./components/SetupPanel.jsx";
import MeetingsPage from "./components/MeetingsPage.jsx";
import CalendarPage from "./components/CalendarPage.jsx";
import AnomaliesPage from "./components/AnomaliesPage.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import "./styles.css";

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

// SVG Icons as inline components (no extra deps)
function IconGrid()     { return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>; }
function IconCalendar() { return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>; }
function IconCalendarGrid() { return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="14" x2="8" y2="14"/><line x1="12" y1="14" x2="12" y2="14"/><line x1="16" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="8" y2="18"/><line x1="12" y1="18" x2="12" y2="18"/></svg>; }
function IconBell()     { return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>; }
function IconInbox()    { return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></svg>; }
function IconSettings() { return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>; }

const PAGE_META = {
  dashboard:  { title: "Dashboard",         subtitle: "Real-time HR cost analytics across all projects" },
  meetings:   { title: "Meetings",           subtitle: "All ingested meetings with attribution and cost breakdown" },
  calendar:   { title: "Calendar",           subtitle: "Week and month view of all your ingested meetings" },
  anomalies:  { title: "Anomaly Detection",  subtitle: "AI-powered alerts for budget, allocation, and attribution issues" },
  review:     { title: "Review Queue",       subtitle: "AI-flagged meetings awaiting human attribution" },
  setup:      { title: "Data & Setup",       subtitle: "Connect calendars, run AI attribution pipeline" },
};

export default function App() {
  const [tab, setTab]           = useState("dashboard");
  const [health, setHealth]     = useState(null);
  const [user, setUser]         = useState(null);
  const [reviewCount, setReviewCount] = useState(0);
  const [anomalyCount, setAnomalyCount] = useState(0);

  // Restore session from token on mount
  useEffect(() => {
    const sessionUser = getSessionUser();
    if (sessionUser) setUser(sessionUser);
    getHealth()
      .then(setHealth)
      .catch(() => setHealth({ status: "unreachable" }));
    getAnomalies()
      .then((r) => setAnomalyCount((r?.anomalies || []).length))
      .catch(() => {});
  }, []);

  const healthStatus = health?.status === "ok" ? "ok" : health ? "bad" : "loading";
  const meta = PAGE_META[tab];

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <div className="app-shell">
        {/* ── Sidebar ── */}
        <aside className="sidebar">
          {/* Logo */}
          <div className="sidebar-logo">
            <div className="logo-icon">🧠</div>
            <div className="logo-title">HR Cost Intelligence</div>
            <div className="logo-sub">Powered by AI · Llama 3</div>
          </div>

          {/* Navigation */}
          <nav className="sidebar-nav">
            <div className="nav-section-label">Analytics</div>

            <button
              id="nav-dashboard"
              className={`nav-item ${tab === "dashboard" ? "active" : ""}`}
              onClick={() => setTab("dashboard")}
            >
              <IconGrid />
              Dashboard
            </button>

            <button
              id="nav-meetings"
              className={`nav-item ${tab === "meetings" ? "active" : ""}`}
              onClick={() => setTab("meetings")}
            >
              <IconCalendar />
              Meetings
            </button>

            <button
              id="nav-calendar"
              className={`nav-item ${tab === "calendar" ? "active" : ""}`}
              onClick={() => setTab("calendar")}
            >
              <IconCalendarGrid />
              Calendar
            </button>

            <button
              id="nav-anomalies"
              className={`nav-item ${tab === "anomalies" ? "active" : ""}`}
              onClick={() => setTab("anomalies")}
            >
              <IconBell />
              Anomalies
              {anomalyCount > 0 && (
                <span className="nav-badge" style={{ background: "#ef4444" }}>{anomalyCount}</span>
              )}
            </button>

            <button
              id="nav-review"
              className={`nav-item ${tab === "review" ? "active" : ""}`}
              onClick={() => setTab("review")}
            >
              <IconInbox />
              Review Queue
              {reviewCount > 0 && (
                <span className="nav-badge">{reviewCount}</span>
              )}
            </button>

            <div className="nav-section-label">Configuration</div>

            <button
              id="nav-setup"
              className={`nav-item ${tab === "setup" ? "active" : ""}`}
              onClick={() => setTab("setup")}
            >
              <IconSettings />
              Data & Setup
            </button>

            {/* Privacy notice in nav */}
            <div
              style={{
                marginTop: "auto",
                padding: "12px 10px 6px",
                borderTop: "1px solid var(--border)",
              }}
            >
              <div
                className="text-xs text-muted"
                style={{ lineHeight: 1.6, display: "flex", gap: 6, alignItems: "flex-start" }}
              >
                <span>🔒</span>
                <span>
                  Aggregate data only. Individual salary details are admin-restricted. Small groups
                  are suppressed for privacy (k={3}).
                </span>
              </div>
            </div>
          </nav>

          {/* Footer: health */}
          <div className="sidebar-footer">
            <div className="health-pill">
              <span className={`health-dot ${healthStatus}`} />
              <div className="health-text">
                <strong>System Status</strong>
                API: {health?.status || "connecting…"} · DB: {health?.db || "—"}
              </div>
            </div>
          </div>
        </aside>

        {/* ── Main content ── */}
        <div className="main-content">
          <header className="topbar">
            <div className="topbar-left">
              <h1 className="page-title">{meta.title}</h1>
              <p className="page-subtitle">{meta.subtitle}</p>
            </div>
            <div className="topbar-actions">
              {user?.isAdmin && (
                <span
                  className="badge"
                  style={{
                    background: "rgba(129,140,248,0.15)",
                    color: "var(--indigo)",
                    border: "1px solid rgba(129,140,248,0.3)",
                    gap: 5,
                  }}
                  title={`Logged in as ${user.email}`}
                >
                  🔑 Admin
                </span>
              )}
              {user && !user.isAdmin && (
                <span className="badge badge-green" title={user.email}>
                  ✓ {user.email}
                </span>
              )}
              <span className="badge badge-muted">
                {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            </div>
          </header>

          <ErrorBoundary>
            <main className="page-content fade-in">
              {tab === "dashboard" && (
                <Dashboard
                  isAdmin={user?.isAdmin ?? false}
                  onReviewCountChange={setReviewCount}
                />
              )}
              {tab === "meetings" && (
                <MeetingsPage isAdmin={user?.isAdmin ?? false} />
              )}
              {tab === "calendar" && (
                <CalendarPage isAdmin={user?.isAdmin ?? false} />
              )}
              {tab === "anomalies" && (
                <AnomaliesPage />
              )}
              {tab === "review" && (
                <ReviewQueue onCountChange={setReviewCount} />
              )}
              {tab === "setup" && (
                <SetupPanel
                  user={user}
                  setUser={(u) => {
                    setUser(u);
                  }}
                  isAdmin={user?.isAdmin ?? false}
                />
              )}
            </main>
          </ErrorBoundary>
        </div>
      </div>
    </GoogleOAuthProvider>
  );
}
