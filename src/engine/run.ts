import "server-only";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import type { Track } from "@/lib/site";
import { mockForecast } from "./mock";
import { parseForecast } from "./parse";
import { buildPrompt } from "./prompt";
import { callProvider, costOf } from "./providers";
import { limits } from "../../sanity.config";
import { hasKey, type ProviderId } from "./registry";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Which update round a forecast belongs to.
 * Closed book: one forecast when the question opens, because the model's
 * knowledge does not change. Open book: one per week while the question is open.
 */
export function roundFor(track: Track, openAt: Date, now: Date): number {
  if (track === "closed") return 0;
  return Math.max(0, Math.floor((now.getTime() - openAt.getTime()) / (7 * DAY)));
}

export async function spentThisMonth(now = new Date()): Promise<number> {
  const db = await getDb();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${schema.forecasts.costUsd}), 0)` })
    .from(schema.forecasts)
    .where(gte(schema.forecasts.createdAt, monthStart));
  return Number(row?.total ?? 0);
}

export function monthlyBudget(): number {
  return Number(process.env.MONTHLY_BUDGET_USD || limits.defaultMonthlyBudgetUsd);
}

export type RunReport = {
  written: number;
  skipped: number;
  failed: { model: string; question: string; error: string }[];
  costUsd: number;
  stoppedForBudget: boolean;
  mock: number;
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

/**
 * One pass over every open question: for each active model and track, write
 * the forecast for the current round if it does not exist yet. Safe to call
 * repeatedly; the unique index makes a second call a no-op.
 */
export async function runForecastRound(opts: { now?: Date; maxCalls?: number } = {}): Promise<RunReport> {
  const now = opts.now ?? new Date();
  const maxCalls = opts.maxCalls ?? limits.maxCallsPerRun;
  const db = await getDb();
  await lockDueQuestions(now);

  const report: RunReport = {
    written: 0,
    skipped: 0,
    failed: [],
    costUsd: 0,
    stoppedForBudget: false,
    mock: 0,
  };

  const open = await db.select().from(schema.questions).where(eq(schema.questions.status, "open"));
  const models = await db.select().from(schema.models).where(eq(schema.models.active, true));
  let spent = await spentThisMonth(now);
  const budget = monthlyBudget();
  let calls = 0;

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
        if (calls >= maxCalls) return report;
        if (spent >= budget) {
          report.stoppedForBudget = true;
          return report;
        }
        calls++;

        const title = q.title[q.lang] ?? Object.values(q.title)[0] ?? "";
        const criteria = q.criteria[q.lang] ?? Object.values(q.criteria)[0] ?? "";

        try {
          let parsed;
          let usage = { tokensIn: 0, tokensOut: 0, searches: 0 };
          let sources: { title: string; url: string }[] = [];
          let mock = false;

          if (hasKey(model.provider as ProviderId)) {
            const prompt = buildPrompt(
              { title, criteria, sourceUrl: q.sourceUrl, resolveBy: q.resolveBy, lang: q.lang },
              track,
              now,
            );
            const result = await callProvider(
              { ...model, provider: model.provider as ProviderId, tier: model.tier as "flagship" },
              prompt,
              track,
            );
            parsed = parseForecast(result.text);
            usage = result;
            sources = result.sources;
          } else {
            mock = true;
            parsed = mockForecast({
              questionSlug: q.slug,
              modelId: model.id,
              track,
              round,
              lang: q.lang,
            });
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
          spent += cost;
          if (mock) report.mock++;
        } catch (err) {
          report.failed.push({
            model: model.id,
            question: q.slug,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
  }
  return report;
}
