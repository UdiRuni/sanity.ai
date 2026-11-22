import "server-only";
import { and, desc, eq, gt, gte, lte, sql } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import type { Model, Question, SanityTest } from "@/db/schema";
import type { SanityVariant } from "@/lib/sanity";
import type { Track } from "@/lib/site";
import { fetchMarketPrice, parseMarketUrl } from "./markets";
import { mockForecast } from "./mock";
import { parseForecast, type ParsedForecast } from "./parse";
import { buildPrompt } from "./prompt";
import { callProvider, costOf } from "./providers";
import {
  buildSanityPrompt,
  mockProbe,
  planSanityTest,
  SANITY_PROMPT_VERSION,
  variantsToRun,
  type SanityPlan,
  type SanityQuestion,
} from "./sanity";
import { limits, sanity as sanitySettings } from "../../sanity.config";
import { hasKey, type ProviderId } from "./registry";

const DAY = 24 * 60 * 60 * 1000;

type Db = Awaited<ReturnType<typeof getDb>>;

/**
 * Which update round a forecast belongs to.
 * Closed book: one forecast when the question opens, because the model's
 * knowledge does not change. Open book: one per week while the question is open.
 */
export function roundFor(track: Track, openAt: Date, now: Date): number {
  if (track === "closed") return 0;
  return Math.max(0, Math.floor((now.getTime() - openAt.getTime()) / (7 * DAY)));
}

/** Money spent this calendar month (UTC) on forecasts and sanity tests together. */
export async function spentThisMonth(now = new Date()): Promise<number> {
  const db = await getDb();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [forecasts] = await db
    .select({ total: sql<number>`coalesce(sum(${schema.forecasts.costUsd}), 0)` })
    .from(schema.forecasts)
    .where(gte(schema.forecasts.createdAt, monthStart));
  const [probes] = await db
    .select({ total: sql<number>`coalesce(sum(${schema.sanityProbes.costUsd}), 0)` })
    .from(schema.sanityProbes)
    .where(gte(schema.sanityProbes.createdAt, monthStart));
  return Number(forecasts?.total ?? 0) + Number(probes?.total ?? 0);
}

/** Whether a model with no API key may write a labelled demo forecast. */
export function mockAllowed(): boolean {
  return !process.env.DATABASE_URL || process.env.MOCK_FORECASTS === "true";
}

export function monthlyBudget(): number {
  return Number(process.env.MONTHLY_BUDGET_USD || limits.defaultMonthlyBudgetUsd);
}

export type RunReport = {
  written: number;
  skipped: number;
  failed: { model: string; question: string; error: string }[];
  /** Spent in this run, on forecasts and sanity tests together. */
  costUsd: number;
  stoppedForBudget: boolean;
  /** True when the time or call limit was reached with work still missing. Call again. */
  moreWork: boolean;
  mock: number;
  marketPrices: number;
  /** Sanity tests started and sanity answers written in this run. */
  sanity: { tests: number; written: number; mock: number };
};

/** Moves questions whose lock time has passed from open to locked. */
export async function lockDueQuestions(now = new Date()): Promise<number> {
  const db = await getDb();
  const rows = await db
    .update(schema.questions)
    .set({ status: "locked" })
    .where(and(eq(schema.questions.status, "open"), lte(schema.questions.lockAt, now)))
    .returning({ id: schema.questions.id });
  return rows.length;
}

/* ---------- One run: shared limits for every model call ---------- */

type Run = {
  db: Db;
  now: Date;
  report: RunReport;
  calls: number;
  maxCalls: number;
  spent: number;
  budget: number;
  started: number;
};

async function startRun(opts: { now?: Date; maxCalls?: number }): Promise<Run> {
  const now = opts.now ?? new Date();
  return {
    db: await getDb(),
    now,
    report: {
      written: 0,
      skipped: 0,
      failed: [],
      costUsd: 0,
      stoppedForBudget: false,
      moreWork: false,
      mock: 0,
      marketPrices: 0,
      sanity: { tests: 0, written: 0, mock: 0 },
    },
    calls: 0,
    maxCalls: opts.maxCalls ?? limits.maxCallsPerRun,
    spent: await spentThisMonth(now),
    budget: monthlyBudget(),
    started: Date.now(),
  };
}

/** Takes one call from the run's allowance, or records why the run must stop. */
function mayCall(run: Run): boolean {
  if (run.calls >= run.maxCalls || Date.now() - run.started > limits.maxRunSeconds * 1000) {
    run.report.moreWork = true;
    return false;
  }
  if (run.spent >= run.budget) {
    run.report.stoppedForBudget = true;
    return false;
  }
  run.calls++;
  return true;
}

/**
 * How a model takes part: a real call when its provider has a key, labelled
 * demo numbers on the local demo database, otherwise not at all.
 */
function modeOf(model: Model): "real" | "mock" | null {
  if (hasKey(model.provider as ProviderId)) return "real";
  return mockAllowed() ? "mock" : null;
}

async function ask(model: Model, prompt: { system: string; user: string }, track: Track) {
  const result = await callProvider(
    { ...model, provider: model.provider as ProviderId, tier: model.tier as "flagship" },
    prompt,
    track,
  );
  return { parsed: parseForecast(result.text), usage: result, sources: result.sources };
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

/* ---------- Forecasts ---------- */

/**
 * One pass over every open question: for each active model and track, write
 * the forecast for the current round if it does not exist yet. Then, with
 * whatever is left of the run, the sanity tests. Safe to call repeatedly; the
 * unique indexes make a second call a no-op.
 */
export async function runForecastRound(opts: { now?: Date; maxCalls?: number } = {}): Promise<RunReport> {
  const run = await startRun(opts);
  const { db, now, report } = run;
  await lockDueQuestions(now);

  const open = await db.select().from(schema.questions).where(eq(schema.questions.status, "open"));

  // Record today's market price for every open question that has a market link.
  for (const q of open) {
    const ref = q.marketUrl ? parseMarketUrl(q.marketUrl) : null;
    if (!ref) continue;
    // One market price a day per question is enough, however often the run is called.
    const [recent] = await db
      .select({ id: schema.marketPrices.id })
      .from(schema.marketPrices)
      .where(
        and(
          eq(schema.marketPrices.questionId, q.id),
          gte(schema.marketPrices.createdAt, new Date(now.getTime() - 20 * 60 * 60 * 1000)),
        ),
      )
      .limit(1);
    if (recent) continue;
    try {
      const probability = await fetchMarketPrice(ref);
      await db.insert(schema.marketPrices).values({ questionId: q.id, probability, source: ref.source, createdAt: now });
      report.marketPrices++;
    } catch (err) {
      report.failed.push({ model: `market:${ref.source}`, question: q.slug, error: message(err) });
    }
  }

  const models = await db.select().from(schema.models).where(eq(schema.models.active, true));
  if (!(await forecastPhase(run, open, models))) return report;
  // Forecasts come first; the sanity test only uses what is left of this run.
  await sanityPhase(run, models);
  return report;
}

/** Returns false when the run had to stop early. */
async function forecastPhase(run: Run, open: Question[], models: Model[]): Promise<boolean> {
  const { db, now, report } = run;
  for (const q of open) {
    if (!q.openAt) continue;
    const existing = await db
      .select({
        modelId: schema.forecasts.modelId,
        track: schema.forecasts.track,
        round: schema.forecasts.round,
      })
      .from(schema.forecasts)
      .where(eq(schema.forecasts.questionId, q.id));
    const have = new Set(existing.map((e) => `${e.modelId}|${e.track}|${e.round}`));

    for (const model of models) {
      // A model only forecasts questions opened after it joined.
      if (model.joinedAt.getTime() > q.openAt.getTime() + DAY) continue;

      const trackList: Track[] = model.supportsOpenBook ? ["closed", "open"] : ["closed"];
      for (const track of trackList) {
        const round = roundFor(track, q.openAt, now);
        if (have.has(`${model.id}|${track}|${round}`)) {
          report.skipped++;
          continue;
        }
        // Demo numbers are only for the local demo database. On a real database
        // a model without an API key simply does not take part.
        const mode = modeOf(model);
        if (!mode) {
          report.skipped++;
          continue;
        }
        if (!mayCall(run)) return false;

        const title = q.title[q.lang] ?? Object.values(q.title)[0] ?? "";
        const criteria = q.criteria[q.lang] ?? Object.values(q.criteria)[0] ?? "";

        try {
          let parsed: ParsedForecast;
          let usage = { tokensIn: 0, tokensOut: 0, searches: 0 };
          let sources: { title: string; url: string }[] = [];
          const mock = mode === "mock";

          if (!mock) {
            const result = await ask(
              model,
              buildPrompt({ title, criteria, sourceUrl: q.sourceUrl, resolveBy: q.resolveBy, lang: q.lang }, track, now),
              track,
            );
            parsed = result.parsed;
            usage = result.usage;
            sources = result.sources;
          } else {
            parsed = mockForecast({ questionSlug: q.slug, modelId: model.id, track, round, lang: q.lang });
          }

          const cost = costOf(model, usage);
          await db
            .insert(schema.forecasts)
            .values({
              questionId: q.id,
              modelId: model.id,
              track,
              round,
              probability: parsed.probability,
              rationale: parsed.rationale,
              keyFactors: parsed.keyFactors,
              changeMind: parsed.changeMind,
              sources,
              tokensIn: usage.tokensIn,
              tokensOut: usage.tokensOut,
              searches: usage.searches,
              costUsd: cost,
              mock,
              createdAt: now,
            })
            .onConflictDoNothing();
          report.written++;
          report.costUsd += cost;
          run.spent += cost;
          if (mock) report.mock++;
        } catch (err) {
          report.failed.push({ model: model.id, question: q.slug, error: message(err) });
        }
      }
    }
  }
  return true;
}

/* ---------- Sanity tests ---------- */

export function sanityQuestionOf(q: Question): SanityQuestion {
  return {
    lang: q.lang,
    title: q.title,
    criteria: q.criteria,
    sourceUrl: q.sourceUrl,
    resolveBy: q.resolveBy,
    eventByDeadline: q.eventByDeadline,
  };
}

/** A question can be tested only if its original text is there and it stays open for at least a day. */
export function isSanityTestable(q: Question, now: Date): boolean {
  return (
    q.status === "open" &&
    q.lockAt !== null &&
    q.lockAt.getTime() > now.getTime() + DAY &&
    Boolean(q.title[q.lang]?.trim()) &&
    Boolean(q.criteria[q.lang]?.trim())
  );
}

/** Starts the sanity test of one question. Returns false if it already had one. */
async function createSanityTest(db: Db, q: Question, now: Date): Promise<boolean> {
  const plan = planSanityTest(sanityQuestionOf(q), now);
  const rows = await db
    .insert(schema.sanityTests)
    .values({
      questionId: q.id,
      batch: 0,
      promptVersion: SANITY_PROMPT_VERSION,
      askedOn: now,
      earlierBy: plan.earlierBy,
      translateTo: plan.translateTo,
      // The run's clock, not the database's, so the daily quota counts what each run saw.
      createdAt: now,
    })
    .onConflictDoNothing()
    .returning({ id: schema.sanityTests.id });
  return rows.length > 0;
}

/** Starts up to `testsPerDay` tests in any 24 hours, newest open questions first. */
async function startDueSanityTests(run: Run): Promise<void> {
  const { db, now } = run;
  if (sanitySettings.testsPerDay <= 0) return;
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.sanityTests)
    .where(gte(schema.sanityTests.createdAt, new Date(now.getTime() - DAY)));
  const room = sanitySettings.testsPerDay - Number(n);
  if (room <= 0) return;

  const candidates = await db
    .select()
    .from(schema.questions)
    .where(
      and(
        eq(schema.questions.status, "open"),
        gt(schema.questions.lockAt, new Date(now.getTime() + DAY)),
        sql`not exists (select 1 from ${schema.sanityTests} where ${schema.sanityTests.questionId} = ${schema.questions.id})`,
      ),
    )
    .orderBy(desc(schema.questions.openAt), desc(schema.questions.id))
    .limit(room + 5); // a few spares, in case some lack their original text

  let started = 0;
  for (const q of candidates) {
    if (started >= room) break;
    if (!isSanityTestable(q, now)) continue;
    if (await createSanityTest(db, q, now)) {
      started++;
      run.report.sanity.tests++;
    }
  }
}

/**
 * Fills in a plan that was missing a check when the test started, for example
 * a translation the admin added later. The dates stay those of the test, so
 * every model still gets the same prompts. A deadline check the admin switched
 * off stops being asked.
 */
async function refreshPlan(db: Db, test: SanityTest, q: Question): Promise<SanityPlan> {
  const fresh = planSanityTest(sanityQuestionOf(q), test.askedOn);
  const patch: { earlierBy?: Date | null; translateTo?: string } = {};
  if (!q.eventByDeadline && test.earlierBy) patch.earlierBy = null;
  if (q.eventByDeadline && !test.earlierBy && fresh.earlierBy) patch.earlierBy = fresh.earlierBy;
  if (!test.translateTo && fresh.translateTo) patch.translateTo = fresh.translateTo;
  if (Object.keys(patch).length > 0) {
    await db.update(schema.sanityTests).set(patch).where(eq(schema.sanityTests.id, test.id));
  }
  return {
    earlierBy: patch.earlierBy !== undefined ? patch.earlierBy : test.earlierBy,
    translateTo: patch.translateTo ?? test.translateTo,
  };
}

/**
 * Starts the day's automatic tests, then fills in every missing answer of
 * every test whose question is still open. One model at a time, so a run that
 * is cut short still leaves complete checks behind. Returns false when the
 * run had to stop early.
 */
async function sanityPhase(run: Run, models: Model[], onlyQuestionId?: number): Promise<boolean> {
  const { db, now } = run;
  const askable = models.filter((m) => m.active && modeOf(m) !== null);
  if (askable.length === 0 || sanitySettings.checks.length === 0) return true;
  if (onlyQuestionId === undefined) await startDueSanityTests(run);

  const rows = await db
    .select({ test: schema.sanityTests, question: schema.questions })
    .from(schema.sanityTests)
    .innerJoin(schema.questions, eq(schema.sanityTests.questionId, schema.questions.id))
    .where(
      and(
        eq(schema.questions.status, "open"),
        gt(schema.questions.lockAt, now),
        onlyQuestionId !== undefined ? eq(schema.questions.id, onlyQuestionId) : undefined,
      ),
    )
    .orderBy(schema.sanityTests.createdAt, schema.sanityTests.id);

  for (const { test, question: q } of rows) {
    if (!q.title[q.lang]?.trim() || !q.criteria[q.lang]?.trim()) continue;
    const plan = await refreshPlan(db, test, q);
    const variants = variantsToRun(plan);
    const existing = await db
      .select({ modelId: schema.sanityProbes.modelId, variant: schema.sanityProbes.variant })
      .from(schema.sanityProbes)
      .where(eq(schema.sanityProbes.testId, test.id));
    const have = new Set(existing.map((e) => `${e.modelId}|${e.variant}`));

    for (const model of askable) {
      for (const variant of variants) {
        if (have.has(`${model.id}|${variant}`)) continue;
        if (!mayCall(run)) return false;
        await askProbe(run, model, q, test, plan, variant);
      }
    }
  }
  return true;
}

async function askProbe(run: Run, model: Model, q: Question, test: SanityTest, plan: SanityPlan, variant: SanityVariant) {
  const { db, report } = run;
  const mock = modeOf(model) === "mock";
  try {
    let parsed: ParsedForecast;
    let usage = { tokensIn: 0, tokensOut: 0, searches: 0 };
    if (!mock) {
      const result = await ask(model, buildSanityPrompt(sanityQuestionOf(q), variant, test.askedOn, plan), "closed");
      parsed = result.parsed;
      usage = result.usage;
    } else {
      parsed = mockProbe({
        questionSlug: q.slug,
        modelId: model.id,
        variant,
        lang: variant === "translated" && plan.translateTo ? plan.translateTo : q.lang,
      });
    }
    const cost = costOf(model, usage);
    const inserted = await db
      .insert(schema.sanityProbes)
      .values({
        testId: test.id,
        modelId: model.id,
        variant,
        probability: parsed.probability,
        rationale: parsed.rationale,
        tokensIn: usage.tokensIn,
        tokensOut: usage.tokensOut,
        costUsd: cost,
        mock,
        createdAt: run.now,
      })
      .onConflictDoNothing()
      .returning({ id: schema.sanityProbes.id });
    report.costUsd += cost;
    run.spent += cost;
    if (inserted.length > 0) {
      report.sanity.written++;
      if (mock) report.sanity.mock++;
    }
  } catch (err) {
    report.failed.push({ model: model.id, question: `${q.slug} (sanity: ${variant})`, error: message(err) });
  }
}

/**
 * Starts (if needed) and runs the sanity test of one question right away,
 * outside the daily quota. Used by the admin page.
 */
export async function runSanityTestNow(
  questionId: number,
  opts: { now?: Date; maxCalls?: number } = {},
): Promise<RunReport> {
  const run = await startRun(opts);
  const [q] = await run.db.select().from(schema.questions).where(eq(schema.questions.id, questionId));
  if (!q || !isSanityTestable(q, run.now)) return run.report;
  if (await createSanityTest(run.db, q, run.now)) run.report.sanity.tests++;
  const models = await run.db.select().from(schema.models).where(eq(schema.models.active, true));
  await sanityPhase(run, models, q.id);
  return run.report;
}
