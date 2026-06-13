/**
 * CSV export helpers (Phase 6 — Polish).
 * Generates a UTF-8 CSV file from the project breakdown table and triggers a
 * browser download without any third-party library.
 */

/** Safely escape a cell value for CSV (wraps in quotes, escapes internal quotes). */
function cell(value) {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Format a number as INR without symbols (for the CSV figures). */
function inrNum(n) {
  if (n == null) return "";
  return Math.round(n).toString();
}

/**
 * Export the project breakdown table as a CSV file.
 * @param {Array}  projects  - rows from the /cost/projects API
 * @param {string} [filename]
 */
export function exportProjectsCsv(projects, filename = "hr-cost-projects.csv") {
  const HEADERS = [
    "Project",
    "Priority",
    "Total Cost (INR)",
    "Budget (INR)",
    "Utilization %",
    "Meetings",
    "Person-hrs",
    "Needs Review",
    "Over Budget",
  ];

  const rows = projects
    .filter((p) => p.project) // exclude unattributed bucket
    .map((p) => [
      cell(p.project),
      cell(p.priority ?? ""),
      cell(inrNum(p.totalCost)),
      cell(inrNum(p.budget)),
      cell(p.budgetUtilization != null ? `${Math.round(p.budgetUtilization * 100)}` : ""),
      cell(p.meetingCount),
      cell(p.personHours),
      cell(p.needsReviewCount ?? 0),
      cell(p.overBudget ? "Yes" : "No"),
    ]);

  const csvContent = [
    HEADERS.join(","),
    ...rows.map((r) => r.join(",")),
    "", // trailing newline
  ].join("\r\n");

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
