import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { CalendarSource, diffMinutes } from "./CalendarSource.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_PATH = path.join(__dirname, "sample-meetings.json");

/**
 * Demo safety net: reads sample-meetings.json and projects each entry onto real dates
 * relative to "now" (via daysAgo + startHour) so the data always lands inside the
 * ingestion window. Carries ground-truth `trueProject` labels for the accuracy eval.
 */
export class MockCalendarSource extends CalendarSource {
  async fetchEvents({ timeMin, timeMax } = {}) {
    const raw = await readFile(SAMPLE_PATH, "utf-8");
    const items = JSON.parse(raw);

    const minMs = timeMin ? new Date(timeMin).getTime() : -Infinity;
    const maxMs = timeMax ? new Date(timeMax).getTime() : Infinity;

    const events = [];
    for (const it of items) {
      const start = atOffset(it.daysAgo, it.startHour);
      const end = new Date(start.getTime() + it.durationMins * 60000);

      // Respect the requested window so the mock behaves like the live source.
      if (start.getTime() < minMs || start.getTime() > maxMs) continue;

      events.push({
        googleEventId: it.id,
        title: it.title,
        description: it.description || "",
        location: it.location || "",
        attendees: (it.attendees || []).map((a) => ({
          email: a.email.toLowerCase(),
          responseStatus: a.responseStatus || "needsAction",
          resource: Boolean(a.resource),
          organizer: Boolean(a.organizer),
        })),
        start,
        end,
        durationMins: diffMinutes(start, end),
        recurrence: it.recurrence || null,
        recurringEventId: null,
        trueProject: it.trueProject ?? null,
      });
    }
    return events;
  }
}

/** A Date `daysAgo` days back, at `hour`:00 local time. */
function atOffset(daysAgo, hour) {
  const d = new Date();
  d.setDate(d.getDate() - (daysAgo || 0));
  d.setHours(hour ?? 9, 0, 0, 0);
  return d;
}
