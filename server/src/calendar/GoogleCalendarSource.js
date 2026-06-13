import { google } from "googleapis";
import { CalendarSource, diffMinutes } from "./CalendarSource.js";
import { authedClientForUser } from "./googleClient.js";
import { EVENTS_PAGE_SIZE } from "../config/constants.js";

/**
 * Live Google Calendar source.
 *
 * Correctness details that matter for cost accuracy:
 *  - singleEvents=true + orderBy=startTime: expand recurring rules into dated INSTANCES,
 *    otherwise we'd get RRULEs with no real start/end.
 *  - pagination via nextPageToken: long windows would otherwise truncate silently.
 *  - we keep responseStatus + resource flags so the cost step can drop declined people
 *    and meeting rooms.
 */
export class GoogleCalendarSource extends CalendarSource {
  async fetchEvents({ user, timeMin, timeMax }) {
    if (!user) throw new Error("GoogleCalendarSource requires a connected user.");

    const auth = authedClientForUser(user);
    const calendar = google.calendar({ version: "v3", auth });

    const events = [];
    let pageToken;

    do {
      const { data } = await calendar.events.list({
        calendarId: "primary",
        singleEvents: true,
        orderBy: "startTime",
        showDeleted: false,
        maxResults: EVENTS_PAGE_SIZE,
        timeMin: new Date(timeMin).toISOString(),
        timeMax: new Date(timeMax).toISOString(),
        pageToken,
      });

      for (const ev of data.items || []) {
        const normalized = normalizeEvent(ev);
        if (normalized) events.push(normalized);
      }
      pageToken = data.nextPageToken;
    } while (pageToken);

    return events;
  }
}

/** Map a raw Google event to our normalized shape; returns null for events to skip. */
function normalizeEvent(ev) {
  // Skip all-day events (no dateTime) and cancelled instances — no person-hours to cost.
  const startISO = ev.start?.dateTime;
  const endISO = ev.end?.dateTime;
  if (!startISO || !endISO) return null;
  if (ev.status === "cancelled") return null;

  const start = new Date(startISO);
  const end = new Date(endISO);

  const attendees = (ev.attendees || []).map((a) => ({
    email: (a.email || "").toLowerCase(),
    responseStatus: a.responseStatus || "needsAction",
    resource: Boolean(a.resource),
    organizer: Boolean(a.organizer),
  }));

  // Solo events have no attendees array; treat the organizer as the sole attendee.
  if (attendees.length === 0 && ev.organizer?.email) {
    attendees.push({
      email: ev.organizer.email.toLowerCase(),
      responseStatus: "accepted",
      resource: false,
      organizer: true,
    });
  }

  return {
    googleEventId: ev.id,
    title: ev.summary || "(no title)",
    description: ev.description || "",
    location: ev.location || "",
    attendees,
    start,
    end,
    durationMins: diffMinutes(start, end),
    recurrence: Array.isArray(ev.recurrence) ? ev.recurrence.join(";") : null,
    recurringEventId: ev.recurringEventId || null,
    trueProject: null,
  };
}
