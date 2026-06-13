import { Meeting } from "../models/Meeting.js";
import { Employee } from "../models/Employee.js";
import { Project } from "../models/Project.js";

/**
 * Cost model (the heart of the product):
 *   meeting cost = Σ over attendees of  hourlyRate × (durationMins / 60)
 * A 1-hour meeting with 6 internal people is 6 person-hours, each priced by that
 * person's rate — never one flat hour.
 *
 * Correctness rules:
 *   - skip attendees who DECLINED (they didn't spend the time)
 *   - skip `resource` entries (meeting rooms / equipment are not people)
 *   - attendees not found in `employees` are "external / uncosted": counted, never ₹0'd
 */

/** email -> employee lookup. */
async function buildEmployeeMap() {
  const emps = await Employee.find().lean();
  const map = new Map();
  for (const e of emps) map.set(e.email.toLowerCase(), e);
  return map;
}

/**
 * Cost a single meeting. `filter` (optional team/role) restricts which internal
 * attendees are counted, so the dashboard can slice cost by team or role.
 */
export function meetingCost(meeting, empMap, filter = {}) {
  const hours = (meeting.durationMins || 0) / 60;
  let cost = 0;
  let internalCount = 0;
  let externalCount = 0;
  const contributors = [];

  for (const a of meeting.attendees || []) {
    if (a.responseStatus === "declined") continue; // didn't attend
    if (a.resource) continue; // meeting room / equipment

    const emp = empMap.get((a.email || "").toLowerCase());
    if (!emp) {
      externalCount++; // external / uncosted — tracked, not silently zeroed
      continue;
    }
    if (filter.team && emp.team !== filter.team) continue;
    if (filter.role && emp.role !== filter.role) continue;

    const contribution = emp.hourlyRate * hours;
    cost += contribution;
    internalCount++;
    contributors.push({
      email: emp.email,
      name: emp.name,
      role: emp.role,
      team: emp.team,
      hours,
      cost: contribution, // admin-only detail (derives the rate) — gated by requireAdmin
    });
  }

  return {
    cost,
    internalCount,
    externalCount,
    personHours: internalCount * hours,
    contributors,
  };
}

/** Full per-meeting cost breakdown for one meeting (used by drill-down / review). */
export async function costForMeeting(googleEventId) {
  const meeting = await Meeting.findOne({ googleEventId }).lean();
  if (!meeting) return null;
  const empMap = await buildEmployeeMap();
  const breakdown = meetingCost(meeting, empMap);
  return {
    googleEventId: meeting.googleEventId,
    title: meeting.title,
    start: meeting.start,
    durationMins: meeting.durationMins,
    project: meeting.attribution?.project ?? null,
    ...breakdown,
  };
}

/**
 * Aggregate HR cost per project across meetings in a window, with optional team/role
 * slicing. Computed app-side (not Mongo aggregation) because the per-attendee rules
 * (declined/resource/external + employee join) are clearest in JS and the dataset is
 * demo-sized. Returns per-project rows with by-team / by-role breakdowns and budget
 * utilization, plus an "unattributed" bucket for meetings with no project.
 */
export async function aggregateByProject({ from, to, team, role } = {}) {
  const empMap = await buildEmployeeMap();
  const projectMeta = await Project.find().lean();
  const metaByName = new Map(projectMeta.map((p) => [p.name, p]));

  const query = {};
  if (from || to) {
    query.start = {};
    if (from) query.start.$gte = new Date(from);
    if (to) query.start.$lte = new Date(to);
  }
  const meetings = await Meeting.find(query).lean();

  const buckets = new Map(); // key -> aggregate
  let totalCost = 0;
  let totalExternal = 0;

  for (const m of meetings) {
    const { cost, externalCount, personHours, contributors } = meetingCost(m, empMap, {
      team,
      role,
    });
    totalCost += cost;
    totalExternal += externalCount;

    const projectName = m.attribution?.project ?? null;
    const key = projectName || "__unattributed__";
    if (!buckets.has(key)) {
      buckets.set(key, {
        project: projectName,
        totalCost: 0,
        meetingCount: 0,
        personHours: 0,
        externalAttendees: 0,
        byTeam: {},
        byRole: {},
        needsReviewCount: 0,
      });
    }
    const b = buckets.get(key);
    b.totalCost += cost;
    b.meetingCount += 1;
    b.personHours += personHours;
    b.externalAttendees += externalCount;
    if (m.attribution?.needsReview) b.needsReviewCount += 1;
    for (const c of contributors) {
      b.byTeam[c.team] = (b.byTeam[c.team] || 0) + c.cost;
      b.byRole[c.role] = (b.byRole[c.role] || 0) + c.cost;
    }
  }

  // Attach project metadata + budget utilization, sort by cost desc.
  const projects = [...buckets.values()].map((b) => {
    const meta = b.project ? metaByName.get(b.project) : null;
    const budget = meta?.budget ?? null;
    return {
      project:           b.project,
      totalCost:         round(b.totalCost),
      meetingCount:      b.meetingCount,
      personHours:       round(b.personHours, 1),
      externalAttendees: b.externalAttendees,
      needsReviewCount:  b.needsReviewCount,
      priority:          meta?.priority ?? null,
      budget,
      budgetUtilization: budget ? round(b.totalCost / budget, 3) : null,
      overBudget:        budget ? b.totalCost > budget : false,
      byTeam:            roundMap(b.byTeam),
      byRole:            roundMap(b.byRole),
    };
  });
  projects.sort((a, z) => z.totalCost - a.totalCost);

  return {
    filters: { from: from || null, to: to || null, team: team || null, role: role || null },
    totals: {
      totalCost: round(totalCost),
      meetings: meetings.length,
      externalAttendees: totalExternal,
      projects: projects.filter((p) => p.project).length,
    },
    projects,
  };
}

function round(n, dp = 2) {
  const f = 10 ** dp;
  return Math.round((n + Number.EPSILON) * f) / f;
}
function roundMap(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) out[k] = round(v);
  return out;
}
