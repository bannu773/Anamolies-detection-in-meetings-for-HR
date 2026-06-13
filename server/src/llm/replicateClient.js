import Replicate from "replicate";
import { REPLICATE_MODEL } from "../config/constants.js";

let _client = null;

/** Lazily build a single Replicate client. Throws if the token is missing. */
function client() {
  if (_client) return _client;
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error("REPLICATE_API_TOKEN is not set.");
  _client = new Replicate({ auth: token });
  return _client;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Detect a 429 and how long to wait. Free/low-credit Replicate accounts are throttled
 *  to ~6 req/min with a burst of 1, so we must pace requests and back off on 429. */
function rateLimitWaitMs(err) {
  const msg = err?.message || "";
  const status = err?.response?.status;
  const is429 = status === 429 || /\b429\b|too many requests|throttled/i.test(msg);
  if (!is429) return null;
  // The error body includes e.g. "retry_after":8 and "resets in ~8s".
  const m = msg.match(/"retry_after":\s*(\d+)/) || msg.match(/resets in ~(\d+)s/);
  const seconds = m ? Number(m[1]) : 8;
  return (seconds + 1) * 1000; // small cushion
}

/**
 * Run the configured Llama model once and return the full text output.
 * Llama instruct models on Replicate stream an array of string chunks; we join them.
 * Retries automatically on 429 (rate limit), waiting the API-suggested `retry_after`.
 *
 * @param {{ prompt: string, system?: string, maxTokens?: number, temperature?: number }} opts
 * @param {{ maxRateLimitRetries?: number }} [cfg]
 * @returns {Promise<string>}
 */
export async function runModel(
  { prompt, system, maxTokens = 200, temperature = 0.1 },
  { maxRateLimitRetries = 6 } = {}
) {
  const input = {
    prompt,
    max_tokens: maxTokens,
    // Low temperature => more deterministic JSON, fewer creative deviations.
    temperature,
    top_p: 0.9,
  };
  if (system) input.system_prompt = system;

  for (let attempt = 0; ; attempt++) {
    try {
      const output = await client().run(REPLICATE_MODEL, { input });
      return Array.isArray(output) ? output.join("") : String(output ?? "");
    } catch (err) {
      const waitMs = rateLimitWaitMs(err);
      if (waitMs != null && attempt < maxRateLimitRetries) {
        await sleep(waitMs);
        continue; // retry after the rate-limit window resets
      }
      throw err;
    }
  }
}

/**
 * Fire a tiny throwaway prediction to pay the cold-start cost before a demo, so the first
 * real attribution isn't slow. Returns true on success, false (swallowed) on failure.
 */
export async function warmup() {
  try {
    await runModel({ prompt: "Reply with the single word: ready", maxTokens: 5 });
    return true;
  } catch (err) {
    console.warn("[llm] warmup failed:", err.message);
    return false;
  }
}

export { REPLICATE_MODEL };
