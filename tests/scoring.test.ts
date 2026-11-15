import { describe, expect, it } from "vitest";
import {
  bootstrapInterval,
  brier,
  calibration,
  median,
  prophecyScore,
  timeWeightedBrier,
} from "@/lib/scoring";

const day = (n: number) => new Date(Date.UTC(2026, 0, 1 + n));

describe("brier", () => {
  it("is 0 for a certain correct forecast and 1 for a certain wrong one", () => {
    expect(brier(1, true)).toBe(0);
    expect(brier(1, false)).toBe(1);
  });
  it("is 0.25 for a coin flip either way", () => {
    expect(brier(0.5, true)).toBe(0.25);
    expect(brier(0.5, false)).toBe(0.25);
  });
});

describe("prophecyScore", () => {
  it("maps coin flip to 0 and perfect to 100", () => {
    expect(prophecyScore(0.25)).toBe(0);
    expect(prophecyScore(0)).toBe(100);
  });
  it("goes negative when worse than a coin flip", () => {
    expect(prophecyScore(0.5)).toBe(-100);
  });
});

describe("timeWeightedBrier", () => {
  it("returns null without forecasts", () => {
    expect(timeWeightedBrier([], day(10), true)).toBeNull();
  });
  it("equals the plain Brier for a single forecast", () => {
    expect(timeWeightedBrier([{ probability: 0.8, at: day(0) }], day(10), true)).toBeCloseTo(0.04);
  });
  it("weights each forecast by how long it stood", () => {
    // 0.5 for 2 days, then 0.9 for 8 days, outcome yes.
    const got = timeWeightedBrier(
      [
        { probability: 0.5, at: day(0) },
        { probability: 0.9, at: day(2) },
      ],
      day(10),
      true,
    );
    expect(got).toBeCloseTo((0.25 * 2 + 0.01 * 8) / 10);
  });
  it("ignores forecasts made after the lock", () => {
    const got = timeWeightedBrier(
      [
        { probability: 0.5, at: day(0) },
        { probability: 0.99, at: day(11) },
      ],
      day(10),
      true,
    );
    expect(got).toBeCloseTo(0.25);
  });
  it("rewards being right early over being right late", () => {
    const early = timeWeightedBrier(
      [
        { probability: 0.9, at: day(0) },
      ],
      day(10),
      true,
    )!;
    const late = timeWeightedBrier(
      [
        { probability: 0.5, at: day(0) },
        { probability: 0.9, at: day(9) },
      ],
      day(10),
      true,
    )!;
    expect(early).toBeLessThan(late);
  });
});

describe("median", () => {
  it("handles odd and even counts", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });
});

describe("bootstrapInterval", () => {
  it("brackets the mean and is deterministic", () => {
    const values = [0.1, 0.2, 0.05, 0.3, 0.15, 0.25, 0.12, 0.18];
    const a = bootstrapInterval(values)!;
    const b = bootstrapInterval(values)!;
    expect(a).toEqual(b);
    const m = values.reduce((x, y) => x + y, 0) / values.length;
    expect(a.low).toBeLessThanOrEqual(m);
    expect(a.high).toBeGreaterThanOrEqual(m);
  });
  it("needs at least two values", () => {
    expect(bootstrapInterval([0.2])).toBeNull();
  });
});

describe("calibration", () => {
  it("bins forecasts and reports the observed rate", () => {
    const bins = calibration(
      [
        { probability: 0.1, outcome: false },
        { probability: 0.15, outcome: false },
        { probability: 0.9, outcome: true },
        { probability: 0.95, outcome: false },
        { probability: 1, outcome: true },
      ],
      5,
    );
    expect(bins).toHaveLength(2);
    expect(bins[0]).toMatchObject({ count: 2, observed: 0 });
    expect(bins[1].count).toBe(3);
    expect(bins[1].observed).toBeCloseTo(2 / 3);
  });
});
