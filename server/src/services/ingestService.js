import { Meeting } from "../models/Meeting.js";
import { getCalendarSource } from "../calendar/index.js";
import { DEFAULT_WINDOW_DAYS } from "../config/constants.js";

/**
 * Fetch events from the chosen source and upsert them into `meetings`, keyed on
 * googleEventId. Upsert => re-ingesting (or the same meeting on multiple calendars)
 * never duplicates. One bad event is skipped, it does not abort the whole batch.
 *
 * @returns {Promise<{ source, fetched, upserted, skipped, errors }>}
 */
export async function ingestMeetings({ user, source, windowDays } = {}) {
  const days = windowDays || DEFAULT_WINDOW_DAYS;
  const timeMax = new Date();
  const timeMin = new Date(timeMax.getTime() - days * 24 * 60 * 60 * 1000);

  const calendarSource = getCalendarSource(source);
  const events = await calendarSource.fetchEvents({ user, timeMin, timeMax });

  let upserted = 0;
  let skipped = 0;
  const errors = [];

  for (const ev of events) {
    try {
      if (!ev.googleEventId || !ev.start || !ev.end) {
        skipped++;
        continue;
      }

      await Meeting.updateOne(
        { googleEventId: ev.googleEventId },
        {
          $set: {
            title: ev.title,
            description: ev.description,
            location: ev.location,
            attendees: ev.attendees,
            start: ev.start,
            end: ev.end,
            durationMins: ev.durationMins,
            recurrence: ev.recurrence,
            recurringEventId: ev.recurringEventId,
            // Ground-truth label only exists in mock data; harmless on live (null).
            ...(ev.trueProject != null ? { trueProject: ev.trueProject } : {}),
          },
          // Don't clobber an existing attribution on re-ingest; only seed it on insert.
          $setOnInsert: {
            attribution: {
              project: null,
              confidence: 0,
              needsReview: true,
              method: "pending",
              modelHash: null,
            },
          },
        },
        { upsert: true }
      );
      upserted++;
    } catch (err) {
      errors.push({ googleEventId: ev.googleEventId, message: err.message });
    }
  }

  return {
    source: source || process.env.CALENDAR_SOURCE || "google",
    window: { from: timeMin, to: timeMax, days },
    fetched: events.length,
    upserted,
    skipped,
    errors,
  };
}
