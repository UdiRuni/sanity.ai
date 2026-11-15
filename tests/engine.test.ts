import { describe, expect, it } from "vitest";
import { mockForecast } from "@/engine/mock";
import { parseForecast } from "@/engine/parse";
import { buildPrompt } from "@/engine/prompt";
import { costOf } from "@/engine/providers";
import { modelRegistry } from "@/engine/registry";

describe("parseForecast", () => {
  it("reads plain JSON", () => {
    const f = parseForecast('{"probability":0.64,"rationale":"r","key_factors":["a","b","c"],"change_my_mind":"x"}');
    expect(f).toEqual({ probability: 0.64, rationale: "r", keyFactors: ["a", "b", "c"], changeMind: "x" });
  });
  it("reads JSON wrapped in prose and code fences", () => {
    const f = parseForecast('Here is my answer:\n```json\n{"probability": 0.2, "rationale": "has } brace"}\n```\nThanks');
    expect(f.probability).toBe(0.2);
    expect(f.rationale).toBe("has } brace");
  });
  it("treats numbers above 1 as percentages", () => {
    expect(parseForecast('{"probability": 64}').probability).toBe(0.64);
  });
  it("clamps to the allowed range", () => {
    expect(parseForecast('{"probability": 0}').probability).toBe(0.01);
    expect(parseForecast('{"probability": 1}').probability).toBe(0.99);
  });
  it("accepts a numeric string", () => {
    expect(parseForecast('{"probability": "0.3"}').probability).toBe(0.3);
  });
  it("rejects replies without a usable probability", () => {
    expect(() => parseForecast("I cannot answer")).toThrow();
    expect(() => parseForecast('{"probability": -3}')).toThrow();
    expect(() => parseForecast('{"probability": 250}')).toThrow();
    expect(() => parseForecast('{"rationale": "none"}')).toThrow();
  });
  it("keeps at most three key factors", () => {
    expect(parseForecast('{"probability":0.5,"key_factors":["a","b","c","d"]}').keyFactors).toHaveLength(3);
  });
});

describe("costOf", () => {
  it("adds token and search costs", () => {
    const model = { priceInPerMTok: 4, priceOutPerMTok: 20, searchPricePer1k: 10 };
    // 30k in, 4k out, 5 searches: 0.12 + 0.08 + 0.05
    expect(costOf(model, { tokensIn: 30_000, tokensOut: 4_000, searches: 5 })).toBeCloseTo(0.25);
  });
});

describe("buildPrompt", () => {
  const q = { title: "Will X happen?", criteria: "X happens", resolveBy: new Date("2027-01-01"), lang: "en" };
  it("forbids tools in closed book and allows search in open book", () => {
    expect(buildPrompt(q, "closed", new Date("2026-11-15")).system).toContain("Do not use any tools");
    expect(buildPrompt(q, "open", new Date("2026-11-15")).system).toContain("web search");
  });
  it("includes the date and the resolution criteria", () => {
    const { user } = buildPrompt(q, "closed", new Date("2026-11-15"));
    expect(user).toContain("2026-11-15");
    expect(user).toContain("X happens");
  });
});

describe("mockForecast", () => {
  it("is deterministic and inside the valid range", () => {
    const args = { questionSlug: "s", modelId: "m", track: "closed", round: 0, lang: "en" };
    const a = mockForecast(args);
    expect(a).toEqual(mockForecast(args));
    expect(a.probability).toBeGreaterThanOrEqual(0.01);
    expect(a.probability).toBeLessThanOrEqual(0.99);
  });
});

describe("modelRegistry", () => {
  it("has unique ids and colors", () => {
    expect(new Set(modelRegistry.map((m) => m.id)).size).toBe(modelRegistry.length);
    expect(new Set(modelRegistry.map((m) => m.color)).size).toBe(modelRegistry.length);
  });
});
