import { Meeting } from "../models/Meeting.js";

/**
 * Score attribution accuracy against ground-truth `trueProject` labels.
 *
 * Only the seeded sample meetings carry labels, so we scope the eval to them (their ids
 * start with "mock-"). A prediction is correct when the attributed project equals the
 * label exactly — and correctly predicting `null` ("no project") counts too, so the model
 * is rewarded for abstaining on genuinely ambiguous meetings.
 */
export async function evaluateAttribution() {
  const labeled = await Meeting.find({ googleEventId: /^mock-/ }).lean();

  if (!labeled.length) {
    return {
      labeledMeetings: 0,
      note: "No labeled sample meetings found. Ingest with source=mock, then run attribution.",
    };
  }

  let correct = 0;
  let pending = 0;
  const mismatches = [];

  for (const m of labeled) {
    const predicted = m.attribution?.project ?? null;
    const truth = m.trueProject ?? null;

    if (m.attribution?.method === "pending") pending++;

    if (predicted === truth) {
      correct++;
    } else {
      mismatches.push({
        title: m.title,
        predicted,
        truth,
        confidence: m.attribution?.confidence ?? null,
      });
    }
  }

  const total = labeled.length;
  const accuracy = total ? correct / total : 0;

  return {
    labeledMeetings: total,
    correct,
    incorrect: total - correct,
    pending,
    accuracy: Number(accuracy.toFixed(4)),
    accuracyPct: `${(accuracy * 100).toFixed(1)}%`,
    target: 0.85,
    meetsTarget: accuracy >= 0.85,
    mismatches,
  };
}
