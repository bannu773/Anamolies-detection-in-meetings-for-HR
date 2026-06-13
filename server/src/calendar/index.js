import { GoogleCalendarSource } from "./GoogleCalendarSource.js";
import { MockCalendarSource } from "./MockCalendarSource.js";

/**
 * Pick a calendar source. Explicit `override` wins (used by the ingest route's ?source=
 * flag); otherwise fall back to the CALENDAR_SOURCE env var; default to Google.
 */
export function getCalendarSource(override) {
  const choice = (override || process.env.CALENDAR_SOURCE || "google").toLowerCase();
  if (choice === "mock") return new MockCalendarSource();
  return new GoogleCalendarSource();
}
