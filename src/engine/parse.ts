import { z } from "zod";

const shape = z.object({
  probability: z.coerce.number(),
  rationale: z.string().default(""),
  key_factors: z.array(z.string()).default([]),
  change_my_mind: z.string().optional(),
});

export type ParsedForecast = {
  probability: number;
  rationale: string;
  keyFactors: string[];
  changeMind: string | null;
};

/** Pulls the first balanced {...} block out of free text. */
function extractJson(text: string): string | null {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Turns a model's raw reply into a forecast. Models wrap JSON in prose or code
 * fences and sometimes answer 64 instead of 0.64, so this is forgiving about
 * format and strict about the result: a probability always ends in [0.01, 0.99].
 */
export function parseForecast(raw: string): ParsedForecast {
  const json = extractJson(raw);
  if (!json) throw new Error("No JSON object in model reply");

  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error("Model reply contained malformed JSON");
  }

  const parsed = shape.parse(data);
  let p = parsed.probability;
  if (!Number.isFinite(p)) throw new Error("Probability is not a number");
  if (p > 1 && p <= 100) p = p / 100; // "64" means 64%
  if (p < 0 || p > 1) throw new Error(`Probability out of range: ${parsed.probability}`);
  p = Math.min(0.99, Math.max(0.01, p));

  return {
    probability: p,
    rationale: parsed.rationale.trim(),
    keyFactors: parsed.key_factors.slice(0, 3).map((s) => s.trim()),
    changeMind: parsed.change_my_mind?.trim() || null,
  };
}
