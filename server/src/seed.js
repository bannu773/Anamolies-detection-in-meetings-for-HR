/**
 * COMPREHENSIVE DEMO SEED
 * ========================
 * Covers every UI case:
 *   ✅ Dashboard KPIs + charts (multiple projects with different costs)
 *   ✅ Budget utilization — some over, some near, some safe
 *   ✅ By-team + by-role drill-down data (engineering, design, data, marketing, leadership)
 *   ✅ Meetings tab — recurring, one-off, various durations, all statuses
 *   ✅ Attribution — AI attributed, human corrected, unattributed (needs review)
 *   ✅ Anomaly A — Over Budget (Orion exceeds budget)
 *   ✅ Anomaly B — Over Allocated (Anita Rao in too many meetings)
 *   ✅ Anomaly C — Attribution Gap (some meetings unattributed)
 *   ✅ Anomaly D — Priority Mismatch (VP spending time on low-priority)
 *   ✅ Review Queue — meetings with low AI confidence
 *   ✅ External attendees tracked
 *   ✅ Declined attendees correctly excluded from cost
 */

import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "./config/db.js";
import { Employee } from "./models/Employee.js";
import { Project } from "./models/Project.js";
import { Meeting } from "./models/Meeting.js";

// ─── Employees ─────────────────────────────────────────────────────────────
// 10 employees across 5 teams, varied salary bands
const employees = [
  // Leadership
  { name: "Anita Rao",      email: "anita@acme.com",   role: "VP Engineering",      team: "Leadership",   band: "L8", hourlyRate: 8000 },
  { name: "Sanjay Mehrotra",email: "sanjay@acme.com",  role: "CTO",                 team: "Leadership",   band: "L9", hourlyRate: 10000 },

  // Engineering
  { name: "Ravi Kumar",     email: "ravi@acme.com",    role: "Engineering Lead",    team: "Engineering",  band: "L6", hourlyRate: 5000 },
  { name: "Arjun Mehta",    email: "arjun@acme.com",   role: "Senior Engineer",     team: "Engineering",  band: "L5", hourlyRate: 4000 },
  { name: "Neha Gupta",     email: "neha@acme.com",    role: "Software Engineer",   team: "Engineering",  band: "L4", hourlyRate: 3000 },

  // Data
  { name: "Deepak Singh",   email: "deepak@acme.com",  role: "Data Eng Lead",       team: "Data",         band: "L6", hourlyRate: 5000 },
  { name: "Priya Das",      email: "priya@acme.com",   role: "Data Analyst",        team: "Data",         band: "L4", hourlyRate: 3000 },

  // Design
  { name: "Meera Iyer",     email: "meera@acme.com",   role: "Product Designer",    team: "Design",       band: "L5", hourlyRate: 3500 },
  { name: "Sara Khan",      email: "sara@acme.com",    role: "UI Designer",         team: "Design",       band: "L3", hourlyRate: 2800 },

  // Marketing
  { name: "Kavya Nair",     email: "kavya@acme.com",   role: "Marketing Manager",   team: "Marketing",    band: "L5", hourlyRate: 4000 },
  { name: "Rohit Verma",    email: "rohit@acme.com",   role: "Marketing Associate", team: "Marketing",    band: "L3", hourlyRate: 2500 },
];

// ─── Projects ───────────────────────────────────────────────────────────────
const projects = [
  {
    name: "Phoenix Mobile App",
    description: "Rebuild of the customer-facing mobile app: onboarding, checkout, payments, push notifications.",
    keywords: ["phoenix", "mobile", "app", "onboarding", "checkout", "payments", "sprint", "ios", "android"],
    budget: 450000,       // will be exceeded → Anomaly A
    priority: "high",
  },
  {
    name: "Atlas Data Platform",
    description: "New analytics data platform: ingestion pipelines, ETL, warehouse schema, Kafka, Spark.",
    keywords: ["atlas", "data", "pipeline", "etl", "warehouse", "schema", "analytics", "kafka", "spark"],
    budget: 700000,       // safely within budget
    priority: "high",
  },
  {
    name: "Orion Marketing Launch",
    description: "Q3 go-to-market campaign: creative assets, paid media, agency coordination, funnel metrics.",
    keywords: ["orion", "campaign", "marketing", "launch", "creative", "paid media", "agency", "funnel"],
    budget: 150000,       // will be exceeded → Anomaly A
    priority: "medium",
  },
  {
    name: "Internal Operations",
    description: "All-hands meetings, 1:1s, performance reviews, interviews, admin, retrospectives, and other non-project internal time.",
    keywords: ["all-hands", "1:1", "interview", "admin", "ops", "retro", "sync", "performance", "review"],
    budget: 300000,       // comfortable
    priority: "low",
  },
  {
    name: "Nexus Security Audit",
    description: "Annual security and compliance audit: penetration testing, SOC 2 review, vulnerability scanning.",
    keywords: ["nexus", "security", "audit", "compliance", "soc2", "pentest", "vulnerability"],
    budget: 200000,
    priority: "high",
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────
function daysAgo(n, hour = 10, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d;
}
function addMins(date, mins) {
  return new Date(date.getTime() + mins * 60000);
}
function att(email, status = "accepted", organizer = false) {
  return { email, responseStatus: status, resource: false, organizer };
}
function room(name) {
  return { email: `${name.replace(/ /g, "")}@resource.calendar.google.com`, responseStatus: "accepted", resource: true, organizer: false };
}

// ─── Meetings ───────────────────────────────────────────────────────────────
const now = new Date();

const meetings = [

  // ═══════════════════════════════════════════════
  // PROJECT: Phoenix Mobile App (HIGH priority)
  // Target: exceed budget to trigger Anomaly A
  // ═══════════════════════════════════════════════

  {
    googleEventId: "PHX-001",
    title: "Phoenix — Sprint Planning",
    description: "Sprint 12 planning for Phoenix Mobile App checkout flow and payment gateway integration.",
    attendees: [
      att("anita@acme.com",  "accepted", true),
      att("ravi@acme.com",   "accepted"),
      att("arjun@acme.com",  "accepted"),
      att("neha@acme.com",   "accepted"),
      att("meera@acme.com",  "accepted"),
      room("Conf Room A"),
    ],
    start: daysAgo(14, 10, 0), end: addMins(daysAgo(14, 10, 0), 90), durationMins: 90,
    recurrence: null,
    attribution: { project: "Phoenix Mobile App", confidence: 0.97, needsReview: false, method: "llm" },
    trueProject: "Phoenix Mobile App",
  },
  {
    googleEventId: "PHX-002",
    title: "Phoenix — Daily Standup",
    description: "Daily standup for Phoenix Mobile App team. Track blockers and progress.",
    attendees: [
      att("ravi@acme.com",   "accepted", true),
      att("arjun@acme.com",  "accepted"),
      att("neha@acme.com",   "accepted"),
      att("meera@acme.com",  "accepted"),
    ],
    start: daysAgo(13, 9, 30), end: addMins(daysAgo(13, 9, 30), 15), durationMins: 15,
    recurrence: "RRULE:FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR",
    recurringEventId: "PHX-STANDUP",
    attribution: { project: "Phoenix Mobile App", confidence: 0.92, needsReview: false, method: "llm" },
    trueProject: "Phoenix Mobile App",
  },
  {
    googleEventId: "PHX-003",
    title: "Phoenix — Daily Standup",
    description: "Daily standup for Phoenix Mobile App team.",
    attendees: [
      att("ravi@acme.com",   "accepted", true),
      att("arjun@acme.com",  "accepted"),
      att("neha@acme.com",   "accepted"),
      att("meera@acme.com",  "declined"), // Sara declined — excluded from cost
    ],
    start: daysAgo(12, 9, 30), end: addMins(daysAgo(12, 9, 30), 15), durationMins: 15,
    recurrence: "RRULE:FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR",
    recurringEventId: "PHX-STANDUP",
    attribution: { project: "Phoenix Mobile App", confidence: 0.92, needsReview: false, method: "llm" },
    trueProject: "Phoenix Mobile App",
  },
  {
    googleEventId: "PHX-004",
    title: "Phoenix — Design Review: Checkout UI",
    description: "Review Figma designs for checkout flow and payment confirmation screens. Phoenix mobile app sprint 12.",
    attendees: [
      att("meera@acme.com",  "accepted", true),
      att("sara@acme.com",   "accepted"),
      att("ravi@acme.com",   "accepted"),
      att("arjun@acme.com",  "accepted"),
      att("vendor@external.com", "accepted"), // external attendee
    ],
    start: daysAgo(11, 14, 0), end: addMins(daysAgo(11, 14, 0), 60), durationMins: 60,
    recurrence: null,
    attribution: { project: "Phoenix Mobile App", confidence: 0.95, needsReview: false, method: "llm" },
    trueProject: "Phoenix Mobile App",
  },
  {
    googleEventId: "PHX-005",
    title: "Phoenix — Backend Architecture Review",
    description: "Review microservices architecture for Phoenix payments backend. API gateway, auth service design.",
    attendees: [
      att("anita@acme.com",  "accepted", true),
      att("ravi@acme.com",   "accepted"),
      att("arjun@acme.com",  "accepted"),
      att("neha@acme.com",   "accepted"),
      att("deepak@acme.com", "accepted"),
    ],
    start: daysAgo(10, 11, 0), end: addMins(daysAgo(10, 11, 0), 120), durationMins: 120,
    recurrence: null,
    attribution: { project: "Phoenix Mobile App", confidence: 0.94, needsReview: false, method: "llm" },
    trueProject: "Phoenix Mobile App",
  },
  {
    googleEventId: "PHX-006",
    title: "Phoenix — Sprint Retrospective",
    description: "Sprint 11 retrospective for the Phoenix mobile app team. What went well, what to improve.",
    attendees: [
      att("ravi@acme.com",   "accepted", true),
      att("arjun@acme.com",  "accepted"),
      att("neha@acme.com",   "accepted"),
      att("meera@acme.com",  "accepted"),
      att("sara@acme.com",   "accepted"),
    ],
    start: daysAgo(7, 16, 0), end: addMins(daysAgo(7, 16, 0), 60), durationMins: 60,
    recurrence: null,
    attribution: { project: "Phoenix Mobile App", confidence: 0.91, needsReview: false, method: "llm" },
    trueProject: "Phoenix Mobile App",
  },
  {
    googleEventId: "PHX-007",
    title: "Phoenix — Stakeholder Demo",
    description: "Demo of Phoenix mobile app beta to product stakeholders and leadership. Showcase new features.",
    attendees: [
      att("anita@acme.com",  "accepted", true),
      att("sanjay@acme.com", "accepted"),
      att("ravi@acme.com",   "accepted"),
      att("meera@acme.com",  "accepted"),
      att("client1@partner.com", "accepted"), // external
      att("client2@partner.com", "accepted"), // external
    ],
    start: daysAgo(5, 15, 0), end: addMins(daysAgo(5, 15, 0), 90), durationMins: 90,
    recurrence: null,
    attribution: { project: "Phoenix Mobile App", confidence: 0.88, needsReview: false, method: "llm" },
    trueProject: "Phoenix Mobile App",
  },
  {
    googleEventId: "PHX-008",
    title: "Phoenix — QA Bug Bash",
    description: "Quality assurance session for Phoenix mobile app v2.1 release. Testing payment flows and edge cases.",
    attendees: [
      att("arjun@acme.com",  "accepted", true),
      att("neha@acme.com",   "accepted"),
      att("meera@acme.com",  "tentative"),
      att("deepak@acme.com", "accepted"),
    ],
    start: daysAgo(3, 10, 0), end: addMins(daysAgo(3, 10, 0), 180), durationMins: 180,
    recurrence: null,
    attribution: { project: "Phoenix Mobile App", confidence: 0.89, needsReview: false, method: "human" },
    trueProject: "Phoenix Mobile App",
  },

  // ═══════════════════════════════════════════════
  // PROJECT: Atlas Data Platform (HIGH priority)
  // ═══════════════════════════════════════════════

  {
    googleEventId: "ATL-001",
    title: "Atlas — Data Pipeline Design",
    description: "Designing the Atlas data platform ingestion pipeline. Kafka topics, Spark jobs, schema registry.",
    attendees: [
      att("deepak@acme.com", "accepted", true),
      att("priya@acme.com",  "accepted"),
      att("ravi@acme.com",   "accepted"),
      att("arjun@acme.com",  "accepted"),
    ],
    start: daysAgo(15, 11, 0), end: addMins(daysAgo(15, 11, 0), 120), durationMins: 120,
    recurrence: null,
    attribution: { project: "Atlas Data Platform", confidence: 0.96, needsReview: false, method: "llm" },
    trueProject: "Atlas Data Platform",
  },
  {
    googleEventId: "ATL-002",
    title: "Atlas — ETL Architecture Sync",
    description: "Weekly sync on Atlas ETL pipeline progress. Review warehouse schema changes and data quality metrics.",
    attendees: [
      att("deepak@acme.com", "accepted", true),
      att("priya@acme.com",  "accepted"),
      att("anita@acme.com",  "accepted"),
      room("Conf Room B"),
    ],
    start: daysAgo(10, 14, 0), end: addMins(daysAgo(10, 14, 0), 60), durationMins: 60,
    recurrence: "RRULE:FREQ=WEEKLY;BYDAY=WE",
    recurringEventId: "ATL-WEEKLY",
    attribution: { project: "Atlas Data Platform", confidence: 0.94, needsReview: false, method: "llm" },
    trueProject: "Atlas Data Platform",
  },
  {
    googleEventId: "ATL-003",
    title: "Atlas — Data Quality Review",
    description: "Monthly Atlas data quality review. Check pipeline SLAs, error rates, and data freshness metrics.",
    attendees: [
      att("deepak@acme.com", "accepted", true),
      att("priya@acme.com",  "accepted"),
      att("arjun@acme.com",  "accepted"),
      att("analytics@vendor.com", "accepted"), // external
    ],
    start: daysAgo(8, 10, 0), end: addMins(daysAgo(8, 10, 0), 90), durationMins: 90,
    recurrence: null,
    attribution: { project: "Atlas Data Platform", confidence: 0.93, needsReview: false, method: "llm" },
    trueProject: "Atlas Data Platform",
  },
  {
    googleEventId: "ATL-004",
    title: "Atlas — Kafka Topic Planning",
    description: "Planning new Kafka topics for Atlas real-time data streams. Event schemas, retention policies.",
    attendees: [
      att("deepak@acme.com", "accepted", true),
      att("ravi@acme.com",   "accepted"),
      att("neha@acme.com",   "accepted"),
    ],
    start: daysAgo(4, 13, 0), end: addMins(daysAgo(4, 13, 0), 60), durationMins: 60,
    recurrence: null,
    attribution: { project: "Atlas Data Platform", confidence: 0.91, needsReview: false, method: "llm" },
    trueProject: "Atlas Data Platform",
  },

  // ═══════════════════════════════════════════════
  // PROJECT: Orion Marketing Launch (MEDIUM priority)
  // Target: exceed budget → Anomaly A
  // Anita (VP) attending → Anomaly D (senior on low-priority? No, medium — mild mismatch)
  // ═══════════════════════════════════════════════

  {
    googleEventId: "ORI-001",
    title: "Orion — Campaign Strategy Workshop",
    description: "Full-day workshop to plan Orion marketing launch Q3 campaign strategy, creative briefs, and agency onboarding.",
    attendees: [
      att("kavya@acme.com",  "accepted", true),
      att("rohit@acme.com",  "accepted"),
      att("anita@acme.com",  "accepted"),   // VP in marketing meeting → Anomaly D
      att("sanjay@acme.com", "accepted"),   // CTO in marketing → expensive!
      att("agency@creativeco.com", "accepted"), // external
      att("agency2@media.com", "accepted"), // external
    ],
    start: daysAgo(20, 9, 0), end: addMins(daysAgo(20, 9, 0), 240), durationMins: 240,
    recurrence: null,
    attribution: { project: "Orion Marketing Launch", confidence: 0.89, needsReview: false, method: "llm" },
    trueProject: "Orion Marketing Launch",
  },
  {
    googleEventId: "ORI-002",
    title: "Orion — Paid Media Planning",
    description: "Planning paid media budget allocation for Orion campaign. Google Ads, Meta, LinkedIn channels.",
    attendees: [
      att("kavya@acme.com",  "accepted", true),
      att("rohit@acme.com",  "accepted"),
      att("anita@acme.com",  "accepted"),   // VP again → Anomaly D
      att("media@agency.com","accepted"),   // external
    ],
    start: daysAgo(17, 11, 0), end: addMins(daysAgo(17, 11, 0), 90), durationMins: 90,
    recurrence: null,
    attribution: { project: "Orion Marketing Launch", confidence: 0.86, needsReview: false, method: "llm" },
    trueProject: "Orion Marketing Launch",
  },
  {
    googleEventId: "ORI-003",
    title: "Orion — Creative Review",
    description: "Review creative assets for Orion launch: ad copy, banner designs, landing page wireframes.",
    attendees: [
      att("kavya@acme.com",  "accepted", true),
      att("rohit@acme.com",  "accepted"),
      att("meera@acme.com",  "accepted"),
      att("sara@acme.com",   "accepted"),
      att("design@agency.com","accepted"),  // external
    ],
    start: daysAgo(12, 14, 0), end: addMins(daysAgo(12, 14, 0), 90), durationMins: 90,
    recurrence: null,
    attribution: { project: "Orion Marketing Launch", confidence: 0.88, needsReview: false, method: "llm" },
    trueProject: "Orion Marketing Launch",
  },
  {
    googleEventId: "ORI-004",
    title: "Orion — Launch Readiness Check",
    description: "Final readiness check before Orion campaign go-live. Review all deliverables, tracking setup, team assignments.",
    attendees: [
      att("kavya@acme.com",  "accepted", true),
      att("rohit@acme.com",  "accepted"),
      att("anita@acme.com",  "accepted"),
      att("sanjay@acme.com", "accepted"),
    ],
    start: daysAgo(2, 10, 0), end: addMins(daysAgo(2, 10, 0), 120), durationMins: 120,
    recurrence: null,
    attribution: { project: "Orion Marketing Launch", confidence: 0.91, needsReview: false, method: "llm" },
    trueProject: "Orion Marketing Launch",
  },

  // ═══════════════════════════════════════════════
  // PROJECT: Internal Operations (LOW priority)
  // Anita heavily attending → Anomaly D (senior on low-priority)
  // ═══════════════════════════════════════════════

  {
    googleEventId: "INT-001",
    title: "Weekly All-Hands",
    description: "Company all-hands meeting. Q3 progress update, OKR review, announcements.",
    attendees: [
      att("sanjay@acme.com", "accepted", true),
      att("anita@acme.com",  "accepted"),
      att("ravi@acme.com",   "accepted"),
      att("deepak@acme.com", "accepted"),
      att("kavya@acme.com",  "accepted"),
      att("meera@acme.com",  "accepted"),
      att("arjun@acme.com",  "accepted"),
      att("neha@acme.com",   "accepted"),
      att("priya@acme.com",  "accepted"),
      att("sara@acme.com",   "accepted"),
      att("rohit@acme.com",  "accepted"),
    ],
    start: daysAgo(7, 17, 0), end: addMins(daysAgo(7, 17, 0), 60), durationMins: 60,
    recurrence: "RRULE:FREQ=WEEKLY;BYDAY=FR",
    recurringEventId: "INT-ALLHANDS",
    attribution: { project: "Internal Operations", confidence: 0.97, needsReview: false, method: "llm" },
    trueProject: "Internal Operations",
  },
  {
    googleEventId: "INT-002",
    title: "1:1 Anita — Ravi",
    description: "Weekly 1:1 between Anita Rao and Ravi Kumar. Engineering team updates, career development.",
    attendees: [
      att("anita@acme.com", "accepted", true),
      att("ravi@acme.com",  "accepted"),
    ],
    start: daysAgo(14, 12, 0), end: addMins(daysAgo(14, 12, 0), 30), durationMins: 30,
    recurrence: "RRULE:FREQ=WEEKLY;BYDAY=MO",
    recurringEventId: "INT-1ON1-AR",
    attribution: { project: "Internal Operations", confidence: 0.95, needsReview: false, method: "llm" },
    trueProject: "Internal Operations",
  },
  {
    googleEventId: "INT-003",
    title: "1:1 Anita — Deepak",
    description: "Weekly 1:1 between Anita Rao and Deepak Singh. Data team updates.",
    attendees: [
      att("anita@acme.com",  "accepted", true),
      att("deepak@acme.com", "accepted"),
    ],
    start: daysAgo(14, 13, 0), end: addMins(daysAgo(14, 13, 0), 30), durationMins: 30,
    recurrence: "RRULE:FREQ=WEEKLY;BYDAY=MO",
    recurringEventId: "INT-1ON1-AD",
    attribution: { project: "Internal Operations", confidence: 0.95, needsReview: false, method: "llm" },
    trueProject: "Internal Operations",
  },
  {
    googleEventId: "INT-004",
    title: "Engineering Performance Reviews",
    description: "Mid-year performance review cycle. Engineering team self-assessments and manager reviews.",
    attendees: [
      att("anita@acme.com",  "accepted", true),
      att("ravi@acme.com",   "accepted"),
      att("sanjay@acme.com", "accepted"),
    ],
    start: daysAgo(9, 14, 0), end: addMins(daysAgo(9, 14, 0), 120), durationMins: 120,
    recurrence: null,
    attribution: { project: "Internal Operations", confidence: 0.96, needsReview: false, method: "llm" },
    trueProject: "Internal Operations",
  },
  {
    googleEventId: "INT-005",
    title: "Interview Panel — Senior Engineer Candidate",
    description: "Technical interview panel for senior engineering position. System design round.",
    attendees: [
      att("ravi@acme.com",   "accepted", true),
      att("arjun@acme.com",  "accepted"),
      att("anita@acme.com",  "accepted"),
      att("candidate@gmail.com", "accepted"), // external — candidate
    ],
    start: daysAgo(6, 10, 0), end: addMins(daysAgo(6, 10, 0), 90), durationMins: 90,
    recurrence: null,
    attribution: { project: "Internal Operations", confidence: 0.94, needsReview: false, method: "llm" },
    trueProject: "Internal Operations",
  },

  // ═══════════════════════════════════════════════
  // PROJECT: Nexus Security Audit (HIGH priority)
  // ═══════════════════════════════════════════════

  {
    googleEventId: "NEX-001",
    title: "Nexus — Security Audit Kickoff",
    description: "Kickoff meeting for Nexus annual SOC 2 compliance and security audit. Scope, timeline, responsibilities.",
    attendees: [
      att("sanjay@acme.com", "accepted", true),
      att("anita@acme.com",  "accepted"),
      att("ravi@acme.com",   "accepted"),
      att("deepak@acme.com", "accepted"),
      att("auditor@securityfirm.com", "accepted"), // external auditor
    ],
    start: daysAgo(18, 10, 0), end: addMins(daysAgo(18, 10, 0), 120), durationMins: 120,
    recurrence: null,
    attribution: { project: "Nexus Security Audit", confidence: 0.93, needsReview: false, method: "llm" },
    trueProject: "Nexus Security Audit",
  },
  {
    googleEventId: "NEX-002",
    title: "Nexus — Penetration Test Debrief",
    description: "Debrief from external pentest team. Review findings, CVSS scores, remediation timeline.",
    attendees: [
      att("anita@acme.com",  "accepted", true),
      att("ravi@acme.com",   "accepted"),
      att("arjun@acme.com",  "accepted"),
      att("neha@acme.com",   "accepted"),
      att("pentest@securityfirm.com", "accepted"), // external
      att("pentest2@securityfirm.com","accepted"), // external
    ],
    start: daysAgo(6, 14, 0), end: addMins(daysAgo(6, 14, 0), 90), durationMins: 90,
    recurrence: null,
    attribution: { project: "Nexus Security Audit", confidence: 0.91, needsReview: false, method: "llm" },
    trueProject: "Nexus Security Audit",
  },

  // ═══════════════════════════════════════════════
  // REVIEW QUEUE — Low AI confidence, needs human review
  // Anomaly C: Some with no project at all
  // ═══════════════════════════════════════════════

  {
    googleEventId: "UNK-001",
    title: "Sync with Product",
    description: "",  // no description → AI can't classify well
    attendees: [
      att("ravi@acme.com",   "accepted", true),
      att("kavya@acme.com",  "accepted"),
      att("meera@acme.com",  "accepted"),
    ],
    start: daysAgo(5, 11, 0), end: addMins(daysAgo(5, 11, 0), 30), durationMins: 30,
    recurrence: null,
    attribution: { project: null, confidence: 0.42, needsReview: true, method: "pending" }, // needs review
    trueProject: "Phoenix Mobile App",
  },
  {
    googleEventId: "UNK-002",
    title: "Q3 Planning",
    description: "Q3 roadmap planning session.",
    attendees: [
      att("sanjay@acme.com", "accepted", true),
      att("anita@acme.com",  "accepted"),
      att("deepak@acme.com", "accepted"),
      att("kavya@acme.com",  "accepted"),
    ],
    start: daysAgo(4, 10, 0), end: addMins(daysAgo(4, 10, 0), 120), durationMins: 120,
    recurrence: null,
    attribution: { project: null, confidence: 0.38, needsReview: true, method: "pending" }, // no project, needs review
    trueProject: null,
  },
  {
    googleEventId: "UNK-003",
    title: "Vendor Call",
    description: "",
    attendees: [
      att("deepak@acme.com", "accepted", true),
      att("priya@acme.com",  "accepted"),
      att("vendor@techco.io","accepted"),  // external
    ],
    start: daysAgo(3, 15, 0), end: addMins(daysAgo(3, 15, 0), 60), durationMins: 60,
    recurrence: null,
    attribution: { project: null, confidence: 0.31, needsReview: true, method: "pending" },
    trueProject: "Atlas Data Platform",
  },
  {
    googleEventId: "UNK-004",
    title: "Team Lunch",
    description: "Monthly team lunch and informal catch-up.",
    attendees: [
      att("ravi@acme.com",   "accepted", true),
      att("arjun@acme.com",  "accepted"),
      att("neha@acme.com",   "accepted"),
      att("meera@acme.com",  "accepted"),
      att("sara@acme.com",   "accepted"),
    ],
    start: daysAgo(1, 13, 0), end: addMins(daysAgo(1, 13, 0), 60), durationMins: 60,
    recurrence: null,
    attribution: { project: null, confidence: 0.18, needsReview: true, method: "pending" },
    trueProject: "Internal Operations",
  },

];

// ─── Seed function ───────────────────────────────────────────────────────────
async function seed() {
  await connectDB();
  console.log("[seed] Connected to DB");

  // Clear existing data
  await Employee.deleteMany({});
  await Project.deleteMany({});
  await Meeting.deleteMany({});
  console.log("[seed] Cleared existing data");

  // Insert
  await Employee.insertMany(employees);
  console.log(`[seed] ✅ Inserted ${employees.length} employees`);

  await Project.insertMany(projects);
  console.log(`[seed] ✅ Inserted ${projects.length} projects`);

  // Build meetings with computed end dates
  const meetingDocs = meetings.map((m) => ({
    ...m,
    end: m.end || addMins(m.start, m.durationMins),
  }));
  await Meeting.insertMany(meetingDocs);
  console.log(`[seed] ✅ Inserted ${meetingDocs.length} meetings`);

  // Summary
  console.log("\n[seed] ═══ DEMO DATA SUMMARY ═══");
  console.log(`  Employees : ${employees.length} (Leadership, Engineering, Data, Design, Marketing)`);
  console.log(`  Projects  : ${projects.length} (2 high, 1 medium, 1 low, 1 high priority)`);
  console.log(`  Meetings  : ${meetingDocs.length} total`);
  console.log(`    - Attributed (AI)  : ${meetingDocs.filter(m => m.attribution.method === "llm").length}`);
  console.log(`    - Attributed (Human): ${meetingDocs.filter(m => m.attribution.method === "human").length}`);
  console.log(`    - Needs Review      : ${meetingDocs.filter(m => m.attribution.needsReview).length}`);
  console.log(`    - Recurring         : ${meetingDocs.filter(m => m.recurrence).length}`);
  console.log("\n[seed] Expected Anomalies:");
  console.log("  🔴 Rule A (Over Budget)        — Phoenix Mobile App + Orion Marketing Launch");
  console.log("  🟡 Rule B (Over-Allocated)     — Anita Rao (VP, attending ~12 meetings)");
  console.log("  🟡 Rule C (Attribution Gap)    — 4 meetings with no project assigned");
  console.log("  🟡 Rule D (Priority Mismatch)  — CTO+VP attending Orion (medium) + Internal Ops (low)");

  await mongoose.connection.close();
  process.exit(0);
}

seed().catch(async (err) => {
  console.error("[seed] ❌ Failed:", err.message);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
