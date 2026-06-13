/**
 * Skeleton loading placeholders (Phase 6 — Polish).
 * Pure CSS shimmer animations — no dependencies.
 * Styles are inlined to keep this self-contained.
 */

const shimmerStyle = {
  background: "linear-gradient(90deg, var(--surface-2) 25%, var(--surface-3) 50%, var(--surface-2) 75%)",
  backgroundSize: "200% 100%",
  animation: "shimmer 1.6s ease-in-out infinite",
  borderRadius: 8,
};

/** Inject the shimmer keyframe once. */
if (typeof document !== "undefined" && !document.getElementById("skeleton-styles")) {
  const style = document.createElement("style");
  style.id = "skeleton-styles";
  style.textContent = `
    @keyframes shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `;
  document.head.appendChild(style);
}

/** A single rectangular shimmer block. */
function Block({ width = "100%", height = 16, style = {} }) {
  return (
    <div
      style={{
        ...shimmerStyle,
        width,
        height,
        ...style,
      }}
    />
  );
}

/** Skeleton placeholder for one KPI card. */
export function SkeletonKpi() {
  return (
    <div className="kpi-card" style={{ pointerEvents: "none" }}>
      <div className="kpi-header">
        <div style={{ ...shimmerStyle, width: 36, height: 36, borderRadius: 10 }} />
      </div>
      <Block height={32} width="60%" style={{ marginBottom: 10 }} />
      <Block height={12} width="80%" />
    </div>
  );
}

/** Skeleton grid of 6 KPI cards. */
export function SkeletonKpiGrid({ count = 6 }) {
  return (
    <div className="kpi-grid">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonKpi key={i} />
      ))}
    </div>
  );
}

/** Skeleton placeholder for N table rows. */
export function SkeletonTable({ rows = 5, cols = 6 }) {
  return (
    <div className="table-wrap">
      <table>
        <tbody>
          {Array.from({ length: rows }).map((_, ri) => (
            <tr key={ri} style={{ pointerEvents: "none" }}>
              {Array.from({ length: cols }).map((_, ci) => (
                <td key={ci} style={{ padding: "14px" }}>
                  <Block height={13} width={ci === 0 ? "70%" : ci % 2 === 0 ? "50%" : "40%"} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
