/**
 * Scoring. Pure functions, no database access, covered by tests.
 *
 * Brier score for a binary question: (p - outcome)^2, lower is better.
 * Always answering 50% scores 0.25, which is the "coin flip" baseline.
 */

export function brier(probability: number, outcome: boolean): number {
  const o = outcome ? 1 : 0;
  return (probability - o) ** 2;
}

/** 0 = coin flip, 100 = perfect, negative = worse than a coin flip. */
export function prophecyScore(meanBrier: number): number {
  return 100 * (1 - meanBrier / 0.25);
}

export type TimedForecast = { probability: number; at: Date };

/**
 * Brier score averaged over the time the question was open. Each forecast
 * counts from the moment it was made until the next one, or until the lock.
 * A model that was right early is rewarded over one that was right late.
 * Time before a model's first forecast is not counted.
 */
export function timeWeightedBrier(
  forecasts: TimedForecast[],
  lockAt: Date,
  outcome: boolean,
): number | null {
  const sorted = forecasts
    .filter((f) => f.at.getTime() <= lockAt.getTime())
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  if (sorted.length === 0) return null;

  let weighted = 0;
  let total = 0;
  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i].at.getTime();
    const end = i + 1 < sorted.length ? sorted[i + 1].at.getTime() : lockAt.getTime();
    const span = Math.max(end - start, 0);
    weighted += brier(sorted[i].probability, outcome) * span;
    total += span;
  }
  // All forecasts landed at the lock instant: fall back to the last one.
  if (total === 0) return brier(sorted[sorted.length - 1].probability, outcome);
  return weighted / total;
}

export function mean(values: number[]): number {
  if (values.length === 0) return NaN;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Small deterministic RNG so confidence intervals do not flicker between requests. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 90% bootstrap interval for the mean of per-question Brier scores. */
export function bootstrapInterval(
  values: number[],
  resamples = 400,
  seed = 7,
): { low: number; high: number } | null {
  if (values.length < 2) return null;
  const rand = mulberry32(seed + values.length);
  const means: number[] = [];
  for (let r = 0; r < resamples; r++) {
    let sum = 0;
    for (let i = 0; i < values.length; i++) {
      sum += values[Math.floor(rand() * values.length)];
    }
    means.push(sum / values.length);
  }
  means.sort((a, b) => a - b);
  return {
    low: means[Math.floor(0.05 * resamples)],
    high: means[Math.min(resamples - 1, Math.floor(0.95 * resamples))],
  };
}

export type CalibrationBin = {
  from: number;
  to: number;
  count: number;
  meanForecast: number;
  observed: number; // share of questions in the bin that resolved yes
};

/** Groups forecasts into probability bins and compares them with what happened. */
export function calibration(
  points: { probability: number; outcome: boolean }[],
  bins = 5,
): CalibrationBin[] {
  const out: CalibrationBin[] = [];
  for (let b = 0; b < bins; b++) {
    const from = b / bins;
    const to = (b + 1) / bins;
    const inBin = points.filter(
      (p) => p.probability >= from && (b === bins - 1 ? p.probability <= to : p.probability < to),
    );
    if (inBin.length === 0) continue;
    out.push({
      from,
      to,
      count: inBin.length,
      meanForecast: mean(inBin.map((p) => p.probability)),
      observed: inBin.filter((p) => p.outcome).length / inBin.length,
    });
  }
  return out;
}

/** A model needs this many resolved questions before it is ranked. */
export const MIN_RESOLVED_FOR_RANK = 30;
