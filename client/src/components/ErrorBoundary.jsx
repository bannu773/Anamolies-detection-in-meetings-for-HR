import { Component } from "react";

/**
 * React Error Boundary (Phase 6 — Polish).
 * Catches unhandled render-time errors in the component tree and shows a
 * friendly recovery card instead of a blank/broken screen.
 *
 * Must be a class component — React's error boundary API requires lifecycle
 * methods not available in function components.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary] Caught error:", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh",
          padding: 32,
        }}
      >
        <div
          className="card"
          style={{
            maxWidth: 520,
            textAlign: "center",
            borderColor: "var(--danger)",
            background: "rgba(239,68,68,0.05)",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: 20,
              fontWeight: 700,
              color: "var(--text)",
              marginBottom: 10,
            }}
          >
            Something went wrong
          </h2>
          <p style={{ color: "var(--text-2)", fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
            An unexpected error occurred in this section. This is likely a temporary issue.
          </p>
          {this.state.error && (
            <pre
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: 12,
                fontSize: 11,
                color: "var(--danger)",
                textAlign: "left",
                overflowX: "auto",
                marginBottom: 20,
                whiteSpace: "pre-wrap",
              }}
            >
              {this.state.error.message}
            </pre>
          )}
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button
              className="btn btn-primary"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              ↺ Try again
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => window.location.reload()}
            >
              ⟳ Reload page
            </button>
          </div>
        </div>
      </div>
    );
  }
}
