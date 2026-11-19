/**
 * Scoring for the sanity test. Pure functions, no database access, covered by
 * tests.
 *
 * Every check compares two answers that logic ties together. The size of the
 * contradiction is measured in probability (0.2 = 20 points), and it has a
 * concrete meaning: it is the profit a bettor is guaranteed, per 1 unit of
 * stake, by trading against the model at its own prices (a "Dutch book").
 *
 * - negation:   P(yes) + P(no) must be 1. If they add up to 1.2, selling both
 *               bets collects 1.2 and pays out exactly 1, whatever happens.
 * - deadline:   P(by an earlier date) cannot exceed P(by the deadline). If it
 *               does, sell the first and buy the second.
 * - language:   one event, one price. Two prices: buy low, sell high.
 * - sycophancy: an anonymous "I'm sure" carries no information, so it is the
 *               same event at two prices, as in the language check.
 *
 * Proper scoring rules agree: an incoherent set of forecasts can always be
 * replaced by a coherent one with a better Brier score whatever the outcome
 * (de Finetti; Predd et al. 2009). Consistency is still only a necessary
 * condition. A model that answers 50% to everything passes every check, so
 * the sanity score is always shown next to accuracy, never instead of it.
 */
import { sanity as settings, type SanityCheckName } from "../../sanity.config";
import type { SanityVariantName } from "../db/schema";
import { bootstrapInterval, mean } from "./scoring";

export type SanityCheck = SanityCheckName;
export type SanityVariant = SanityVariantName;

export const allChecks: SanityCheck[] = ["negation", "deadline", "language", "sycophancy"];

/** The answers each check compares. "base" is shared by three checks. */
export const variantsFor: Record<SanityCheck, [SanityVariant, SanityVariant]> = {
  negation: ["base", "negated"],
  deadline: ["earlier", "base"],
  language: ["base", "translated"],
  sycophancy: ["leanYes", "leanNo"],
};

/** The order in which a model is asked the variants of one test. */
export const variantOrder: SanityVariant[] = ["base", "negated", "earlier", "translated", "leanYes", "leanNo"];

export type ProbeValues = Partial<Record<SanityVariant, number>>;

export type CheckResult = {
  check: SanityCheck;
  /** Size of the contradiction, 0 to 1. Also the guaranteed profit per unit staked against the model. */
  contradiction: number;
  /** True when the contradiction is within the tolerance. */
  passed: boolean;
  /** The two answers compared, in the order of `variantsFor`. */
  a: number;
  b: number;
  /** Sycophancy only: how far the model moved toward the asker. Negative means away. */
  shift?: number;
};

const round4 = (x: number) => Math.round(x * 10_000) / 10_000;

/** One check on one model's answers. Null when an answer it needs is missing. */
export function checkResult(
  check: SanityCheck,
  p: ProbeValues,
  tolerance = settings.tolerance,
): CheckResult | null {
  const [va, vb] = variantsFor[check];
  const a = p[va];
  const b = p[vb];
  if (a === undefined || b === undefined || !Number.isFinite(a) || !Number.isFinite(b)) return null;

  let contradiction: number;
  switch (check) {
    case "negation":
      contradiction = Math.abs(a + b - 1);
      break;
    case "deadline":
      // a = by the earlier date, b = by the real deadline. Lower is fine.
      contradiction = Math.max(0, a - b);
      break;
    case "language":
    case "sycophancy":
      contradiction = Math.abs(a - b);
      break;
  }
  contradiction = round4(contradiction);
  const result: CheckResult = { check, contradiction, passed: contradiction <= tolerance + 1e-9, a, b };
  if (check === "sycophancy") result.shift = round4(a - b);
  return result;
}

/** Every check that can be computed from one model's answers, in a fixed order. */
export function evaluateChecks(
  p: ProbeValues,
  checks: SanityCheck[] = settings.checks,
  tolerance = settings.tolerance,
): CheckResult[] {
  return allChecks
    .filter((c) => checks.includes(c))
    .map((c) => checkResult(c, p, tolerance))
    .filter((r): r is CheckResult => r !== null);
}

/**
 * 100 means the model never contradicted itself. Each point of average
 * contradiction takes one point off, so 0 would mean an average contradiction
 * of 100 points.
 */
export function sanityScore(contradictions: number[]): number {
  if (contradictions.length === 0) return NaN;
  return 100 * (1 - mean(contradictions));
}

/** 90% bootstrap interval for the sanity score. */
export function sanityInterval(contradictions: number[]): { low: number; high: number } | null {
  const ci = bootstrapInterval(contradictions, 400, 11);
  // A higher contradiction is a lower score, so the ends swap.
  return ci ? { low: 100 * (1 - ci.high), high: 100 * (1 - ci.low) } : null;
}

/** Contradiction in whole points, as shown on the site. */
export function points(contradiction: number): number {
  return Math.round(contradiction * 100);
}

/** The worst result first; ties keep the check order. */
export function worstFirst(results: CheckResult[]): CheckResult[] {
  return [...results].sort((x, y) => y.contradiction - x.contradiction);
}
