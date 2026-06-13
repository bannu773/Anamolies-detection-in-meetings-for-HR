import axios from "axios";
import { saveToken, getToken } from "./auth.js";

const baseURL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export const api = axios.create({ baseURL });

// --- Bearer token interceptor (Phase 6) ---
// Attaches the session JWT to every request that has a stored token.
// The server only checks it on protected routes (/cost/meeting/:id, /anomalies).
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers["Authorization"] = `Bearer ${token}`;
  return config;
});

// --- Auth / ingestion (Phase 1) ---
export async function connectGoogle(code) {
  const { data } = await api.post("/auth/google", { code });
  // Phase 6: persist the session JWT returned by the server
  if (data.token) saveToken(data.token);
  return data;
}
export async function ingest({ email, source, windowDays }) {
  const { data } = await api.post("/ingest", { email, source, windowDays });
  return data;
}
export async function getMeetings() {
  const { data } = await api.get("/ingest/meetings");
  return data;
}
export async function getHealth() {
  const { data } = await api.get("/health");
  return data;
}

// --- Attribution (Phase 2) ---
export async function warmup() {
  const { data } = await api.post("/attribution/warmup");
  return data;
}
export async function runAttribution(body = {}) {
  const { data } = await api.post("/attribution/run", body);
  return data;
}
export async function getEval() {
  const { data } = await api.get("/attribution/eval");
  return data;
}
export async function getReviewQueue() {
  const { data } = await api.get("/attribution/review");
  return data;
}
export async function correctAttribution(googleEventId, project) {
  const { data } = await api.patch(`/attribution/${googleEventId}`, { project });
  return data;
}

// --- Cost (Phase 3) ---
export async function getProjectCosts({ from, to, team, role } = {}) {
  const { data } = await api.get("/cost/projects", { params: { from, to, team, role } });
  return data;
}
export async function getMeetingCost(googleEventId) {
  // ADMIN ONLY — server returns 401/403 if token is missing or not admin.
  const { data } = await api.get(`/cost/meeting/${googleEventId}`);
  return data;
}

// --- Anomalies (Phase 5) ---
export async function getAnomalies({ from, to } = {}) {
  const { data } = await api.get("/anomalies", { params: { from, to } });
  return data;
}

// --- Meta ---
export async function getProjectsMeta() {
  const { data } = await api.get("/meta/projects");
  return data;
}
export async function getTeams() {
  const { data } = await api.get("/meta/teams");
  return data;
}

// --- Formatting helpers ---
const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
export const formatINR = (n) => inr.format(n || 0);
