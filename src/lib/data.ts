import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import type {
  Forecast,
  Localized,
  MarketPrice,
  Model,
  Question,
  QuestionStatus,
  SanityProbe,
  SanityTest,
} from "@/db/schema";
import { sanity as sanitySettings } from "../../sanity.config";
import {
  evaluateChecks,
  sanityInterval,
  sanityScore,
  worstFirst,
  type CheckResult,
  type ProbeValues,
  type SanityCheck,
  type SanityVariant,
} from "./sanity";
import {
  bootstrapInterval,
  brier,
  calibration,
  mean,
  median,
  MIN_RESOLVED_FOR_RANK,
  prophecyScore,
  timeWeightedBrier,
} from "./scoring";
import { editionsVisibleTo, type Locale, type Track } from "./site";

/** Text in the reader's language, falling back to the original. */
export function pick(text: Localized, locale: string, originalLang?: string): string {
  return text[locale] ?? (originalLang ? text[originalLang] : undefined) ?? Object.values(text)[0] ?? "";
}

export type ModelForecast = { model: Model; forecast: Forecast };

/** The most recent forecast from each model on one track. */
export function latestPerModel(forecasts: Forecast[], models: Model[], track: Track): ModelForecast[] {
  const byModel = new Map<string, Forecast>();
  for (const f of forecasts) {
    if (f.track !== track) continue;
    const cur = byModel.get(f.modelId);
    if (!cur || f.createdAt.getTime() > cur.createdAt.getTime()) byModel.set(f.modelId, f);
  }
  return models
    .filter((m) => byModel.has(m.id))
    .map((m) => ({ model: m, forecast: byModel.get(m.id)! }));
}

export type QuestionView = {
  question: Question;
  forecasts: Forecast[];
  /** Latest forecasts on the track that has the most information. */
  latest: ModelForecast[];
  median: number | null;
  spread: number; // max minus min, the size of the disagreement
  /** Latest prediction-market price for this question, if it has a market link. */
  market: MarketPrice | null;
  marketHistory: MarketPrice[];
};

function toView(
  question: Question,
  forecasts: Forecast[],
  models: Model[],
  prices: MarketPrice[] = [],
): QuestionView {
  // Show closed book on lists: every model takes part in it.
  const latest = latestPerModel(forecasts, models, "closed");
  const ps = latest.map((l) => l.forecast.probability);
  const marketHistory = [...prices].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return {
    question,
    forecasts,
    latest,
    median: ps.length ? median(ps) : null,
    spread: ps.length ? Math.max(...ps) - Math.min(...ps) : 0,
    market: marketHistory[marketHistory.length - 1] ?? null,
    marketHistory,
  };
}

export async function getModels(): Promise<Model[]> {
  const db = await getDb();
  return db.select().from(schema.models).orderBy(schema.models.joinedAt, schema.models.id);
}

export async function listQuestions(
  locale: Locale,
  statuses: QuestionStatus[],
): Promise<QuestionView[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.questions)
    .where(
      and(
        inArray(schema.questions.status, statuses),
        inArray(schema.questions.edition, editionsVisibleTo(locale)),
      ),
    )
    .orderBy(desc(schema.questions.openAt), desc(schema.questions.createdAt));
  if (rows.length === 0) return [];
  const models = await getModels();
  const fs = await db
    .select()
    .from(schema.forecasts)
    .where(
      inArray(
        schema.forecasts.questionId,
        rows.map((r) => r.id),
      ),
    );
  const prices = await db
    .select()
    .from(schema.marketPrices)
    .where(
      inArray(
        schema.marketPrices.questionId,
        rows.map((r) => r.id),
      ),
    );
  const byQuestion = new Map<number, Forecast[]>();
  for (const f of fs) {
    if (!byQuestion.has(f.questionId)) byQuestion.set(f.questionId, []);
    byQuestion.get(f.questionId)!.push(f);
  }
  const pricesByQuestion = new Map<number, MarketPrice[]>();
  for (const p of prices) {
    if (!pricesByQuestion.has(p.questionId)) pricesByQuestion.set(p.questionId, []);
    pricesByQuestion.get(p.questionId)!.push(p);
  }
  return rows.map((q) => toView(q, byQuestion.get(q.id) ?? [], models, pricesByQuestion.get(q.id) ?? []));
}

export async function getQuestion(slug: string): Promise<(QuestionView & { models: Model[] }) | null> {
  const db = await getDb();
  const [q] = await db.select().from(schema.questions).where(eq(schema.questions.slug, slug));
  if (!q) return null;
  const models = await getModels();
  const fs = await db.select().from(schema.forecasts).where(eq(schema.forecasts.questionId, q.id));
  const prices = await db.select().from(schema.marketPrices).where(eq(schema.marketPrices.questionId, q.id));
  return { ...toView(q, fs, models, prices), models };
}

export async function hasMockData(): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .select({ id: schema.forecasts.id })
    .from(schema.forecasts)
    .where(eq(schema.forecasts.mock, true))
    .limit(1);
  return rows.length > 0;
}

/** The model whose final closed-book forecast was nearest to what happened. */
export function closestModel(view: QuestionView): ModelForecast | null {
  const q = view.question;
  if (q.outcome === null || view.latest.length === 0) return null;
  const target = q.outcome ? 1 : 0;
  return [...view.latest].sort(
    (a, b) => Math.abs(a.forecast.probability - target) - Math.abs(b.forecast.probability - target),
  )[0];
}

/* ---------- Leaderboard ---------- */

export type LeaderRow = {
  id: string; // model id, "panel" for the median of all models, or "market"
  model: Model | null;
  resolved: number;
  meanBrier: number;
  score: number;
  scoreLow: number | null;
  scoreHigh: number | null;
  /** Average margin over the median model on the same questions. Positive is better. */
  relative: number;
  ranked: boolean;
  /**
   * Average Brier margin over the market on the questions both forecast.
   * Positive means the model beat the market. Null when there is no overlap.
   */
  vsMarket: number | null;
  sharedWithMarket: number;
};

export type Leaderboard = {
  rows: LeaderRow[];
  resolvedQuestions: number;
  /** How many resolved questions had a market price. */
  marketQuestions: number;
  /** Per-question Brier by model, used by the model profile. */
  perModel: Map<string, { question: Question; brier: number; final: number }[]>;
};

export async function getLeaderboard(locale: Locale, track: Track): Promise<Leaderboard> {
  const resolved = await listQuestions(locale, ["resolved"]);
  const models = await getModels();
  const perModel = new Map<string, { question: Question; brier: number; final: number }[]>();
  const relative = new Map<string, number[]>();
  const panel: number[] = [];
  const market: number[] = [];
  const versusMarket = new Map<string, number[]>();

  for (const view of resolved) {
    const q = view.question;
    if (q.outcome === null || !q.lockAt) continue;
    const scores: { id: string; b: number; final: number }[] = [];
    for (const m of models) {
      const fs = view.forecasts.filter((f) => f.modelId === m.id && f.track === track);
      const b = timeWeightedBrier(
        fs.map((f) => ({ probability: f.probability, at: f.createdAt })),
        q.lockAt,
        q.outcome,
      );
      if (b === null) continue;
      const last = [...fs].sort((a, c) => c.createdAt.getTime() - a.createdAt.getTime())[0];
      scores.push({ id: m.id, b, final: last.probability });
    }
    if (scores.length === 0) continue;
    const med = median(scores.map((s) => s.b));
    for (const s of scores) {
      if (!perModel.has(s.id)) perModel.set(s.id, []);
      perModel.get(s.id)!.push({ question: q, brier: s.b, final: s.final });
      if (!relative.has(s.id)) relative.set(s.id, []);
      relative.get(s.id)!.push(med - s.b);
    }
    panel.push(brier(median(scores.map((s) => s.final)), q.outcome));

    // The market is scored exactly like a model: time-weighted over its price history.
    const marketBrier = timeWeightedBrier(
      view.marketHistory.map((p) => ({ probability: p.probability, at: p.createdAt })),
      q.lockAt,
      q.outcome,
    );
    if (marketBrier !== null) {
      market.push(marketBrier);
      for (const s of scores) {
        if (!versusMarket.has(s.id)) versusMarket.set(s.id, []);
        versusMarket.get(s.id)!.push(marketBrier - s.b);
      }
    }
  }

  const toRow = (id: string, model: Model | null, briers: number[], rel: number[]): LeaderRow => {
    const mb = mean(briers);
    const ci = bootstrapInterval(briers);
    return {
      id,
      model,
      resolved: briers.length,
      meanBrier: mb,
      score: prophecyScore(mb),
      // A lower Brier is a higher score, so the interval ends swap.
      scoreLow: ci ? prophecyScore(ci.high) : null,
      scoreHigh: ci ? prophecyScore(ci.low) : null,
      relative: rel.length ? mean(rel) : 0,
      ranked: briers.length >= MIN_RESOLVED_FOR_RANK,
      vsMarket: versusMarket.get(id)?.length ? mean(versusMarket.get(id)!) : null,
      sharedWithMarket: versusMarket.get(id)?.length ?? 0,
    };
  };

  const rows: LeaderRow[] = [];
  for (const m of models) {
    const entries = perModel.get(m.id);
    if (!entries?.length) continue;
    rows.push(
      toRow(
        m.id,
        m,
        entries.map((e) => e.brier),
        relative.get(m.id) ?? [],
      ),
    );
  }
  if (panel.length) rows.push(toRow("panel", null, panel, []));
  if (market.length) rows.push(toRow("market", null, market, []));
  rows.sort((a, b) => Number(b.ranked) - Number(a.ranked) || b.score - a.score);

  return { rows, resolvedQuestions: panel.length, marketQuestions: market.length, perModel };
}

export async function getModelProfile(id: string, locale: Locale) {
  const models = await getModels();
  const model = models.find((m) => m.id === id);
  if (!model) return null;
  const tracks: Track[] = model.supportsOpenBook ? ["closed", "open"] : ["closed"];
  const boards = await Promise.all(tracks.map((t) => getLeaderboard(locale, t)));
  const closed = boards[0];
  const entries = closed.perModel.get(id) ?? [];
  const points = entries.map((e) => ({ probability: e.final, outcome: e.question.outcome === true }));
  const sorted = [...entries].sort((a, b) => a.brier - b.brier);
  return {
    model,
    rows: tracks.map((t, i) => ({ track: t, row: boards[i].rows.find((r) => r.id === id) ?? null })),
    rank: closed.rows.filter((r) => r.model).findIndex((r) => r.id === id) + 1,
    calibration: calibration(points, 5),
    best: sorted.slice(0, 3),
    worst: sorted.slice(-3).reverse(),
    meanForecast: points.length ? mean(points.map((p) => p.probability)) : null,
  };
}

/* ---------- Sanity test ---------- */

/**
 * The checks a test supports. The deadline check also needs the admin's
 * confirmation that the question is about something happening by a date,
 * which can be switched off after the test started.
 */
export function activeChecks(test: SanityTest, question: Question): SanityCheck[] {
  return sanitySettings.checks.filter((c) => {
    if (c === "deadline") return Boolean(test.earlierBy) && question.eventByDeadline;
    if (c === "language") return Boolean(test.translateTo);
    return true;
  });
}

export type SanityModelResult = {
  model: Model;
  values: ProbeValues;
  rationales: Partial<Record<SanityVariant, string>>;
  /** Only complete checks: both answers are in. */
  checks: CheckResult[];
  /** This model's sanity score on this one question. */
  score: number;
  worst: CheckResult;
  mock: boolean;
};

export type QuestionSanity = { test: SanityTest; results: SanityModelResult[] };

/** Every model's complete checks on one test, the biggest contradiction first. */
export function sanityResults(
  test: SanityTest,
  question: Question,
  probes: SanityProbe[],
  models: Model[],
): SanityModelResult[] {
  const checks = activeChecks(test, question);
  const byModel = new Map<string, SanityProbe[]>();
  for (const p of probes) {
    if (p.testId !== test.id) continue;
    if (!byModel.has(p.modelId)) byModel.set(p.modelId, []);
    byModel.get(p.modelId)!.push(p);
  }
  const out: SanityModelResult[] = [];
  for (const model of models) {
    const mine = byModel.get(model.id);
    if (!mine?.length) continue;
    const values: ProbeValues = {};
    const rationales: Partial<Record<SanityVariant, string>> = {};
    for (const p of mine) {
      values[p.variant] = p.probability;
      rationales[p.variant] = p.rationale;
    }
    const results = evaluateChecks(values, checks);
    if (results.length === 0) continue;
    out.push({
      model,
      values,
      rationales,
      checks: results,
      score: sanityScore(results.map((r) => r.contradiction)),
      worst: worstFirst(results)[0],
      mock: mine.some((p) => p.mock),
    });
  }
  return out.sort(
    (a, b) => b.worst.contradiction - a.worst.contradiction || a.model.name.localeCompare(b.model.name),
  );
}

export async function getQuestionSanity(question: Question, models: Model[]): Promise<QuestionSanity | null> {
  const db = await getDb();
  const [test] = await db
    .select()
    .from(schema.sanityTests)
    .where(and(eq(schema.sanityTests.questionId, question.id), eq(schema.sanityTests.batch, 0)));
  if (!test) return null;
  const probes = await db.select().from(schema.sanityProbes).where(eq(schema.sanityProbes.testId, test.id));
  return { test, results: sanityResults(test, question, probes, models) };
}

export type SanityRow = {
  model: Model;
  checks: number;
  score: number;
  scoreLow: number | null;
  scoreHigh: number | null;
  ranked: boolean;
  /** Average contradiction per kind of check. */
  byCheck: Partial<Record<SanityCheck, { n: number; mean: number }>>;
  mock: boolean;
};

/** One model's result on one check of one question. */
export type SanityEntry = { question: Question; test: SanityTest; model: Model; result: CheckResult };

export type SanityBoard = {
  rows: SanityRow[];
  /** Questions with at least one complete check. */
  tests: number;
  checks: number;
  entries: SanityEntry[];
};

export async function getSanityBoard(locale: Locale): Promise<SanityBoard> {
  const db = await getDb();
  const tests = await db
    .select({ test: schema.sanityTests, question: schema.questions })
    .from(schema.sanityTests)
    .innerJoin(schema.questions, eq(schema.sanityTests.questionId, schema.questions.id))
    .where(
      and(
        inArray(schema.questions.edition, editionsVisibleTo(locale)),
        inArray(schema.questions.status, ["open", "locked", "resolved", "annulled"]),
      ),
    );
  if (tests.length === 0) return { rows: [], tests: 0, checks: 0, entries: [] };
  const models = await getModels();
  const probes = await db
    .select()
    .from(schema.sanityProbes)
    .where(
      inArray(
        schema.sanityProbes.testId,
        tests.map((r) => r.test.id),
      ),
    );

  const entries: SanityEntry[] = [];
  const perModel = new Map<string, { model: Model; results: CheckResult[]; mock: boolean }>();
  let testsWithResults = 0;
  for (const { test, question } of tests) {
    const results = sanityResults(test, question, probes, models);
    if (results.length > 0) testsWithResults++;
    for (const r of results) {
      if (!perModel.has(r.model.id)) perModel.set(r.model.id, { model: r.model, results: [], mock: false });
      const agg = perModel.get(r.model.id)!;
      agg.results.push(...r.checks);
      agg.mock ||= r.mock;
      for (const c of r.checks) entries.push({ question, test, model: r.model, result: c });
    }
  }

  const rows: SanityRow[] = [];
  for (const { model, results, mock } of perModel.values()) {
    const contradictions = results.map((r) => r.contradiction);
    const ci = sanityInterval(contradictions);
    const byCheck: SanityRow["byCheck"] = {};
    for (const r of results) {
      const cur = byCheck[r.check] ?? { n: 0, mean: 0 };
      byCheck[r.check] = { n: cur.n + 1, mean: (cur.mean * cur.n + r.contradiction) / (cur.n + 1) };
    }
    rows.push({
      model,
      checks: results.length,
      score: sanityScore(contradictions),
      scoreLow: ci?.low ?? null,
      scoreHigh: ci?.high ?? null,
      ranked: results.length >= sanitySettings.minChecksForRank,
      byCheck,
      mock,
    });
  }
  rows.sort((a, b) => Number(b.ranked) - Number(a.ranked) || b.score - a.score || b.checks - a.checks);
  return { rows, tests: testsWithResults, checks: entries.length, entries };
}

/**
 * The biggest contradiction among tests asked since `since` (all of them when
 * not given). Only checks that failed count: a "worst" that passed is no story.
 */
export function biggestContradiction(entries: SanityEntry[], since?: Date): SanityEntry | null {
  let best: SanityEntry | null = null;
  for (const e of entries) {
    if (e.result.passed) continue;
    if (since && e.test.askedOn.getTime() < since.getTime()) continue;
    if (!best || e.result.contradiction > best.result.contradiction) best = e;
  }
  return best;
}

/* ---------- Admin ---------- */

export async function getAdminData() {
  const db = await getDb();
  const pending = await db
    .select()
    .from(schema.questions)
    .where(eq(schema.questions.status, "pending"))
    .orderBy(desc(schema.questions.votes));
  const locked = await db
    .select()
    .from(schema.questions)
    .where(inArray(schema.questions.status, ["locked", "open"]))
    .orderBy(schema.questions.resolveBy);
  const tests = locked.length
    ? await db
        .select({
          questionId: schema.sanityTests.questionId,
          answers: sql<number>`count(${schema.sanityProbes.id})`,
        })
        .from(schema.sanityTests)
        .leftJoin(schema.sanityProbes, eq(schema.sanityProbes.testId, schema.sanityTests.id))
        .where(
          inArray(
            schema.sanityTests.questionId,
            locked.map((q) => q.id),
          ),
        )
        .groupBy(schema.sanityTests.questionId)
    : [];
  /** Sanity answers per question; a question with a test but no answers yet maps to 0. */
  const sanityAnswers = new Map(tests.map((r) => [r.questionId, Number(r.answers)]));
  return { pending, awaiting: locked, sanityAnswers };
}
