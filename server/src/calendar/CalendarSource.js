/**
 * CalendarSource is the interface every calendar backend implements. Ingestion code
 * depends only on this shape, so we can swap live Google for the local mock (demo safety
 * net) without touching the pipeline.
 *
 * A "normalized event" returned by fetchEvents() looks like:
 * {
 *   googleEventId, title, description, location,
 *   attendees: [{ email, responseStatus, resource, organizer }],
 *   start: Date, end: Date, durationMins, recurrence, recurringEventId,
 *   trueProject  // mock-only; null for live data
 * }
 */
export class CalendarSource {
  /**
   * @param {{ user?: object, timeMin?: Date, timeMax?: Date }} _opts
   * @returns {Promise<Array<object>>} normalized events
   */
  async fetchEvents(_opts) {
    throw new Error("fetchEvents() not implemented");
  }
}

/** Compute whole-minute duration between two Dates (floored, never negative). */
export function diffMinutes(start, end) {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(0, Math.round(ms / 60000));
}
