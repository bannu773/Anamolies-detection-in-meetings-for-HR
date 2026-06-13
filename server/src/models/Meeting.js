import mongoose from "mongoose";

/**
 * One calendar event instance. `googleEventId` is unique so re-ingesting (or the same
 * meeting appearing on multiple attendees' calendars) upserts instead of duplicating.
 *
 * `attendees` stores per-person response status so cost computation can skip people who
 * DECLINED and skip meeting-room resources — they didn't actually spend the time.
 *
 * `attribution` is embedded (1:1). `trueProject` is an optional ground-truth label used
 * only for the accuracy eval harness; it is never set from production data.
 */
const attendeeSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    responseStatus: { type: String, default: "needsAction" }, // accepted | declined | tentative | needsAction
    resource: { type: Boolean, default: false }, // true => meeting room / equipment, not a person
    organizer: { type: Boolean, default: false },
  },
  { _id: false }
);

const meetingSchema = new mongoose.Schema(
  {
    googleEventId: { type: String, required: true, unique: true, index: true },
    title: { type: String, default: "(no title)" },
    description: { type: String, default: "" }, // event body — strong attribution signal
    location: { type: String, default: "" },
    attendees: { type: [attendeeSchema], default: [] },
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    durationMins: { type: Number, required: true },
    recurrence: { type: String, default: null }, // RRULE string or null
    recurringEventId: { type: String, default: null }, // ties instances to their series

    attribution: {
      project: { type: String, default: null }, // project name or null
      confidence: { type: Number, default: 0 }, // 0..1
      needsReview: { type: Boolean, default: true },
      method: { type: String, default: "pending" }, // pending | llm | human | fallback
      modelHash: { type: String, default: null }, // cache key: hash of inputs+model
    },

    trueProject: { type: String, default: null }, // eval-only ground-truth label
  },
  { timestamps: true }
);

export const Meeting = mongoose.model("Meeting", meetingSchema);
