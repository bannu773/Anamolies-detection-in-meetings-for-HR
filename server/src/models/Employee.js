import mongoose from "mongoose";

/**
 * An internal employee. `email` is the join key against meeting attendees.
 * `hourlyRate` is admin-only data — never expose it in shared/aggregate views.
 *
 * `team` is required by the dashboard's "drill-down by team" (Phase 4).
 * `band`/`role` map a designation to cost; we store the resolved hourlyRate directly
 * so a meeting's cost is a simple lookup.
 */
const employeeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    role: { type: String, required: true }, // designation, e.g. "Senior Engineer"
    band: { type: String, default: null }, // optional salary band, e.g. "L5"
    team: { type: String, required: true }, // e.g. "Engineering", "Design"
    hourlyRate: { type: Number, required: true }, // admin-only; in your currency (e.g. INR)
  },
  { timestamps: true }
);

export const Employee = mongoose.model("Employee", employeeSchema);
