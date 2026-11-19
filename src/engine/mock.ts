import type { ParsedForecast } from "./parse";

/**
 * Demo forecasts for when no API key is configured. They are deterministic
 * pseudo-random numbers, not model output, and every one is stored with
 * mock=true so the site can label them as demo data.
 */

/** Made-up per-model skill, only so demo rankings are not a tie. */
export const demoSkill: Record<string, number> = {
  "claude-opus-5-5": 0.82,
  "gpt-sol": 0.8,
  "gemini-4": 0.76,
  "grok-4-7": 0.68,
  "claude-haiku-5-5": 0.55,
  "gpt-luna": 0.5,
  deepseek: 0.58,
  llama: 0.42,
  "gemini-flash": 0.62,
  "gemini-flash-lite": 0.5,
  "nemotron-ultra": 0.57,
  "ernie-flash": 0.44,
  "inkling-small": 0.47,
};

export function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

export function mockForecast(args: {
  questionSlug: string;
  modelId: string;
  track: string;
  round: number;
  lang: string;
  /** Per-model skill between 0 and 1, used only to make demo rankings differ. */
  skill?: number;
  /** When known (seeding resolved demo questions), forecasts lean toward it. */
  outcome?: boolean | null;
}): ParsedForecast {
  const { questionSlug, modelId, track, round, lang } = args;
  const lean = hash(`lean:${questionSlug}`); // what "the evidence" suggests
  const noise = hash(`${questionSlug}:${modelId}:${track}:${round}`) - 0.5;
  const skill = args.skill ?? 0.5;

  let anchor = 0.15 + lean * 0.7;
  if (args.outcome !== undefined && args.outcome !== null) {
    const truth = args.outcome ? 0.85 : 0.15;
    const pull = 0.25 + 0.5 * skill + (track === "open" ? 0.1 : 0);
    anchor = anchor * (1 - pull) + truth * pull;
  }
  const spread = track === "open" ? 0.22 : 0.34;
  const p = Math.min(0.97, Math.max(0.03, anchor + noise * spread * (1.3 - skill)));

  const he = lang === "he";
  return {
    probability: Math.round(p * 100) / 100,
    rationale: he
      ? "תחזית הדגמה. לא הוגדר מפתח API, ולכן המספר הזה לא הגיע ממודל אמיתי."
      : "Demo forecast. No API key is configured, so this number did not come from a real model.",
    keyFactors: he
      ? ["נתוני הדגמה", "לא תחזית אמיתית", "הגדירו מפתח API"]
      : ["Demo data", "Not a real forecast", "Configure an API key"],
    changeMind: null,
  };
}
