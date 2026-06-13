import { Meeting } from "../models/Meeting.js";
import { Employee } from "../models/Employee.js";
import { Project } from "../models/Project.js";
import { meetingCost } from "./costService.js";
import {
  WORK_HOURS_PER_DAY,
  BUDGET_WARN_RATIO,
  OVERALLOCATION_WARN_RATIO,
  SENIOR_RATE_THRESHOLD,
  LOW_PRIORITY_SHARE_THRESHOLD,
  UNATTRIBUTED_CLUSTER_SIZE,
  CONFIDENCE_THRESHOLD,
  DEFAULT_WINDOW_DAYS,
} from "../config/constants.js";

/**
 * Rule-based anomaly detection. One pass over the meetings builds per-project and
 * per-person rollups; four rules then read those rollups:
 *   A) project over / approaching budget
 *   B) attribution gaps (unattributed or low-confidence meetings)
 *   C) over-allocation (too much of the work week in meetings) + double-booking
 *   D) expensive people spending heavily on low-priority work
 * Returns a list of anomalies (with severity) plus supporting insights.
 */
export async function detectAnomalies({ from, to, isAdmin = false } = {}) {
  const timeMax = to ? new Date(to) : new Date();
  const timeMin = from ? new Date(from) : new Date(timeMax.getTime() - DEFAULT_WINDOW_DAYS * 864e5);

  const employees = await Employee.find().lean();
  const empByEmail = new Map(employees.map((e) => [e.email.toLowerCase(), e]));
  const projects = await Project.find().lean();
  const priorityByProject = new Map(projects.map((p) => [p.name, p.priority]));

  const meetings = await Meeting.find({ start: { $gte: timeMin, $lte: timeMax } }).lean();

  // Rollups
  const perProject = new Map(); // name -> { cost }
  const perPerson = new Map(); // email -> { name, role, rate, totalCost, totalHours, lowPriorityCost, intervals[] }
  let unattributedCount = 0;
  let unattributedCost = 0;
  let lowConfidenceCount = 0;

  for (const m of meetings) {
    const { cost, contributors } = meetingCost(m, empByEmail);
    const project = m.attribution?.project ?? null;
    const priority = project ? priorityByProject.get(project) : null;

    // attribution-gap signals
    if (!project) {
      unattributedCount++;
      unattributedCost += cost;
    }
    if (m.attribution?.needsReview && (m.attribution?.confidence ?? 0) < CONFIDENCE_THRESHOLD) {
      lowConfidenceCount++;
    }

    if (project) perProject.set(project, { cost: (perProject.get(project)?.cost || 0) + cost });

    for (const c of contributors) {
      if (!perPerson.has(c.email)) {
        const emp = empByEmail.get(c.email);
        perPerson.set(c.email, {
          name: c.name, role: c.role, team: c.team, rate: emp?.hourlyRate || 0,
          totalCost: 0, totalHours: 0, lowPriorityCost: 0, intervals: [],
        });
      }
      const p = perPerson.get(c.email);
      p.totalCost += c.cost;
      p.totalHours += c.hours;
      if (priority === "low") p.lowPriorityCost += c.cost;
      p.intervals.push({ start: new Date(m.start), end: new Date(m.end), title: m.title });
    }
  }

  const anomalies = [];

  // --- Rule A: project over / approaching budget ---
  for (const proj of projects) {
    const cost = perProject.get(proj.name)?.cost || 0;
    if (!proj.budget) continue;
    const util = cost / proj.budget;
    if (util >= 1) {
      anomalies.push(mk("over_budget", "high",
        `${proj.name} is over budget`,
        `Attributed HR cost ₹${round(cost)} exceeds the ₹${proj.budget} budget (${pct(util)}).`,
        { project: proj.name, cost: round(cost), budget: proj.budget, utilization: round(util, 3) }));
    } else if (util >= BUDGET_WARN_RATIO) {
      anomalies.push(mk("approaching_budget", "medium",
        `${proj.name} is approaching its budget`,
        `At ₹${round(cost)} of ₹${proj.budget} (${pct(util)}), past the ${pct(BUDGET_WARN_RATIO)} warning line.`,
        { project: proj.name, cost: round(cost), budget: proj.budget, utilization: round(util, 3) }));
    }
  }

  // --- Rule B: attribution gaps ---
  if (unattributedCount > 0 || lowConfidenceCount > 0) {
    const severity = unattributedCount + lowConfidenceCount >= UNATTRIBUTED_CLUSTER_SIZE ? "medium" : "low";
    anomalies.push(mk("attribution_gap", severity,
      "Meetings without clear project attribution",
      `${unattributedCount} meeting(s) (₹${round(unattributedCost)}) have no project, and ${lowConfidenceCount} were attributed below the ${CONFIDENCE_THRESHOLD} confidence line. Review them so this cost isn't invisible.`,
      { unattributedCount, unattributedCost: round(unattributedCost), lowConfidenceCount }));
  }

  // --- Rule C: over-allocation + double-booking ---
  const spanDays = Math.max(1, Math.round((timeMax - timeMin) / 864e5));
  const workdays = Math.max(1, Math.round((spanDays * 5) / 7)); // approx weekdays in window
  const availableHours = workdays * WORK_HOURS_PER_DAY;
  const busiest = [];

  for (const [email, p] of perPerson) {
    const loadRatio = p.totalHours / availableHours;
    busiest.push({ email, name: p.name, hours: round(p.totalHours, 1), loadPct: round(loadRatio * 100, 1) });

    if (loadRatio >= OVERALLOCATION_WARN_RATIO) {
      anomalies.push(mk("over_allocation", "medium",
        `${p.name} is over-allocated to meetings`,
        `${round(p.totalHours, 1)}h in meetings over ~${workdays} workdays = ${pct(loadRatio)} of available time.`,
        { email, hours: round(p.totalHours, 1), availableHours, loadPct: round(loadRatio * 100, 1) }));
    }

    // double-booking: sort intervals, flag overlaps
    const overlaps = findOverlaps(p.intervals);
    if (overlaps.length) {
      anomalies.push(mk("double_booked", "high",
        `${p.name} is double-booked`,
        `${overlaps.length} overlapping meeting(s), e.g. "${overlaps[0].a}" overlaps "${overlaps[0].b}". A person can't be in two meetings at once — cost is being double-counted.`,
        { email, overlaps }));
    }
  }
  busiest.sort((a, b) => b.hours - a.hours);

  // --- Rule D: expensive people on low-priority work ---
  for (const [email, p] of perPerson) {
    if (p.rate < SENIOR_RATE_THRESHOLD || p.totalCost === 0) continue;
    const share = p.lowPriorityCost / p.totalCost;
    if (share >= LOW_PRIORITY_SHARE_THRESHOLD) {
      // Strip personally identifiable salary data for non-admins (Phase 6 privacy).
      const metrics = isAdmin
        ? { email, role: p.role, rate: p.rate, lowPriorityCost: round(p.lowPriorityCost), totalCost: round(p.totalCost), share: round(share, 3) }
        : { role: p.role, lowPriorityCost: round(p.lowPriorityCost), totalCost: round(p.totalCost), share: round(share, 3) };
      anomalies.push(mk("senior_on_low_priority", "medium",
        `${p.name} spends heavily on low-priority work`,
        `${pct(share)} of ${p.name}'s meeting cost (₹${round(p.lowPriorityCost)} of ₹${round(p.totalCost)}) is on low-priority projects.`,
        metrics));
    }
  }

  // order by severity
  const rank = { high: 0, medium: 1, low: 2 };
  anomalies.sort((a, b) => rank[a.severity] - rank[b.severity]);

  return {
    window: { from: timeMin, to: timeMax, workdays, availableHours },
    counts: { total: anomalies.length, high: anomalies.filter((a) => a.severity === "high").length },
    anomalies,
    insights: { busiestPeople: busiest.slice(0, 5) },
  };
}

/** Pairwise overlap scan over one person's meeting intervals. */
function findOverlaps(intervals) {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const out = [];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start < sorted[i - 1].end) {
      out.push({ a: sorted[i - 1].title, b: sorted[i].title });
    }
  }
  return out;
}

function mk(type, severity, title, detail, metrics) {
  return { type, severity, title, detail, ...metrics };
}
const round = (n, dp = 0) => { const f = 10 ** dp; return Math.round((n + Number.EPSILON) * f) / f; };
const pct = (r) => `${Math.round(r * 100)}%`;
