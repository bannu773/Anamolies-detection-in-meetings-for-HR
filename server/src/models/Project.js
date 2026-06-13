import mongoose from "mongoose";

/**
 * A project / workstream that meetings get attributed to.
 * `keywords` + `description` are fed to the LLM as attribution context.
 * `budget` and `priority` are consumed by anomaly detection (Phase 5):
 *   - budget: flag projects whose attributed HR cost exceeds it.
 *   - priority: flag expensive people spending heavy time on low-priority work.
 */
const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String, default: "" },
    keywords: { type: [String], default: [] },
    budget: { type: Number, default: null }, // HR cost budget in your currency
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
  },
  { timestamps: true }
);

export const Project = mongoose.model("Project", projectSchema);
