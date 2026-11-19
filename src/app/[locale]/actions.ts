"use server";

import { randomUUID } from "node:crypto";
import { and, eq, gte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db/client";
import { parseMarketUrl } from "@/engine/markets";
import type { Localized } from "@/db/schema";
import { isSanityTestable, runForecastRound, runSanityTestNow } from "@/engine/run";
import { ADMIN_COOKIE, adminToken, hashPassword, isAdmin } from "@/lib/admin";
import { categories, editionOf, isLocale, site, type Locale } from "@/lib/site";

const DAY = 24 * 60 * 60 * 1000;
const VISITOR_COOKIE = "sanity_visitor";

function localeOf(form: FormData): Locale {
  const raw = String(form.get("locale") ?? "he");
  return isLocale(raw) ? raw : "he";
}

/** Anonymous browser id used for one-vote-per-question and suggestion limits. */
async function visitorId(): Promise<string> {
  const jar = await cookies();
  let id = jar.get(VISITOR_COOKIE)?.value;
  if (!id) {
    id = randomUUID();
    jar.set(VISITOR_COOKIE, id, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365, path: "/" });
  }
  return id;
}

/* ---------- Public actions ---------- */

export async function suggestQuestion(form: FormData) {
  const locale = localeOf(form);
  const back = `/${locale}/suggest`;
  const title = String(form.get("title") ?? "").trim();
  const criteria = String(form.get("criteria") ?? "").trim();
  const sourceUrl = String(form.get("sourceUrl") ?? "").trim();
  const name = String(form.get("name") ?? "").trim().slice(0, 40);
  const category = String(form.get("category") ?? "world");
  const resolveBy = new Date(String(form.get("resolveBy") ?? ""));

  if (title.length < 15 || title.length > 200 || !/[?؟]$/.test(title)) redirect(`${back}?error=title`);
  if (criteria.length < 20 || criteria.length > 600) redirect(`${back}?error=criteria`);
  const ahead = resolveBy.getTime() - Date.now();
  if (!Number.isFinite(ahead) || ahead < 3 * DAY || ahead > 366 * DAY) redirect(`${back}?error=date`);
  if (sourceUrl && !/^https?:\/\/\S+\.\S+/.test(sourceUrl)) redirect(`${back}?error=url`);

  const db = await getDb();
  const visitor = await visitorId();
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.questions)
    .where(
      and(
        eq(schema.questions.suggesterId, visitor),
        gte(schema.questions.createdAt, new Date(Date.now() - DAY)),
      ),
    );
  if (Number(n) >= 3) redirect(`${back}?error=limit`);

  await db.insert(schema.questions).values({
    slug: `q-${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`,
    status: "pending",
    edition: editionOf[locale],
    lang: locale,
    title: { [locale]: title },
    criteria: { [locale]: criteria },
    sourceUrl: sourceUrl || null,
    category: (categories as readonly string[]).includes(category) ? category : "world",
    suggestedBy: name || null,
    suggesterId: visitor,
    resolveBy,
  });
  revalidatePath(back);
  redirect(`${back}?ok=1`);
}

export async function voteForQuestion(form: FormData) {
  const locale = localeOf(form);
  const questionId = Number(form.get("questionId"));
  if (!Number.isInteger(questionId)) return;
  const db = await getDb();
  const visitor = await visitorId();
  const inserted = await db
    .insert(schema.votes)
    .values({ questionId, voterId: visitor })
    .onConflictDoNothing()
    .returning({ questionId: schema.votes.questionId });
  if (inserted.length) {
    await db
      .update(schema.questions)
      .set({ votes: sql`${schema.questions.votes} + 1` })
      .where(and(eq(schema.questions.id, questionId), eq(schema.questions.status, "pending")));
  }
  revalidatePath(`/${locale}/suggest`);
}

/* ---------- Admin ---------- */

async function requireAdmin() {
  if (!(await isAdmin())) throw new Error("Not authorized");
}

export async function adminLogin(form: FormData) {
  const locale = localeOf(form);
  const token = adminToken();
  const given = hashPassword(String(form.get("password") ?? ""));
  if (!token || given !== token) redirect(`/${locale}/admin?error=1`);
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 12,
    path: "/",
  });
  redirect(`/${locale}/admin`);
}

export async function adminLogout(form: FormData) {
  (await cookies()).delete(ADMIN_COOKIE);
  redirect(`/${localeOf(form)}/admin`);
}

/**
 * Reads the sanity test settings shared by the approval form and the settings
 * form: whether the question is about something happening by its date, and a
 * translation into another site language for the language check. An empty
 * translation field removes that translation; the original text is never touched.
 */
function sanityFields(form: FormData, q: { lang: string; title: Localized; criteria: Localized }) {
  const other = String(form.get("otherLang") ?? "");
  const eventByDeadline = form.get("eventByDeadline") === "on";
  if (!(site.locales as readonly string[]).includes(other) || other === q.lang) {
    return { eventByDeadline, title: q.title, criteria: q.criteria };
  }
  const titleOther = String(form.get("titleOther") ?? "").trim().slice(0, 200);
  const criteriaOther = String(form.get("criteriaOther") ?? "").trim().slice(0, 600);
  const title: Localized = { ...q.title };
  const criteria: Localized = { ...q.criteria };
  if (titleOther) title[other] = titleOther;
  else delete title[other];
  if (criteriaOther) criteria[other] = criteriaOther;
  else delete criteria[other];
  return { eventByDeadline, title, criteria };
}

export async function approveQuestion(form: FormData) {
  await requireAdmin();
  const locale = localeOf(form);
  const id = Number(form.get("id"));
  const db = await getDb();
  const [q] = await db.select().from(schema.questions).where(eq(schema.questions.id, id));
  if (!q || q.status !== "pending") return;

  const title = String(form.get("title") ?? "").trim();
  const criteria = String(form.get("criteria") ?? "").trim();
  const edition = String(form.get("edition") ?? q.edition);
  const marketUrl = String(form.get("marketUrl") ?? "").trim();
  const marketRef = marketUrl ? parseMarketUrl(marketUrl) : null;
  const now = new Date();
  const edited = {
    ...q,
    title: title ? { ...q.title, [q.lang]: title } : q.title,
    criteria: criteria ? { ...q.criteria, [q.lang]: criteria } : q.criteria,
  };
  const sanity = sanityFields(form, edited);
  await db
    .update(schema.questions)
    .set({
      status: "open",
      title: sanity.title,
      criteria: sanity.criteria,
      eventByDeadline: sanity.eventByDeadline,
      edition: edition === "global" ? "global" : q.edition,
      // An unrecognised market URL is kept, with prices entered by hand.
      marketUrl: marketUrl || null,
      marketSource: marketUrl ? (marketRef?.source ?? "manual") : null,
      openAt: now,
      // Forecasts freeze a day before the outcome is due.
      lockAt: new Date(Math.max(q.resolveBy.getTime() - DAY, now.getTime() + DAY)),
    })
    .where(eq(schema.questions.id, id));
  revalidatePath(`/${locale}`, "layout");
}

export async function rejectQuestion(form: FormData) {
  await requireAdmin();
  const locale = localeOf(form);
  const db = await getDb();
  await db
    .update(schema.questions)
    .set({ status: "rejected", rejectReason: String(form.get("reason") ?? "").slice(0, 300) || null })
    .where(and(eq(schema.questions.id, Number(form.get("id"))), eq(schema.questions.status, "pending")));
  revalidatePath(`/${locale}`, "layout");
}

export async function resolveQuestion(form: FormData) {
  await requireAdmin();
  const locale = localeOf(form);
  const id = Number(form.get("id"));
  const verdict = String(form.get("verdict"));
  const url = String(form.get("resolutionUrl") ?? "").trim();
  const db = await getDb();
  const [q] = await db.select().from(schema.questions).where(eq(schema.questions.id, id));
  if (!q || (q.status !== "open" && q.status !== "locked")) return;
  const now = new Date();

  if (verdict === "annul") {
    await db.update(schema.questions).set({ status: "annulled", resolvedAt: now }).where(eq(schema.questions.id, id));
  } else if (verdict === "yes" || verdict === "no") {
    await db
      .update(schema.questions)
      .set({
        status: "resolved",
        outcome: verdict === "yes",
        resolutionUrl: url || null,
        resolvedAt: now,
        // If it resolves early, the lock moves to now so later forecasts cannot count.
        lockAt: q.lockAt && q.lockAt.getTime() < now.getTime() ? q.lockAt : now,
      })
      .where(eq(schema.questions.id, id));
  }
  revalidatePath(`/${locale}`, "layout");
}

/** Records the market's current YES price by hand, in percent. */
export async function recordMarketPrice(form: FormData) {
  await requireAdmin();
  const locale = localeOf(form);
  const id = Number(form.get("id"));
  const percent = Number(String(form.get("percent") ?? "").replace("%", ""));
  if (!Number.isInteger(id) || !Number.isFinite(percent) || percent < 1 || percent > 99) return;
  const db = await getDb();
  const [q] = await db.select().from(schema.questions).where(eq(schema.questions.id, id));
  if (!q || q.status !== "open") return;
  await db
    .insert(schema.marketPrices)
    .values({ questionId: id, probability: percent / 100, source: q.marketSource ?? "manual" });
  if (!q.marketSource) {
    await db.update(schema.questions).set({ marketSource: "manual" }).where(eq(schema.questions.id, id));
  }
  revalidatePath(`/${locale}`, "layout");
}

export async function runRoundNow(form: FormData) {
  await requireAdmin();
  const locale = localeOf(form);
  const report = await runForecastRound({ maxCalls: 60 });
  revalidatePath(`/${locale}`, "layout");
  const params = new URLSearchParams({
    written: String(report.written),
    skipped: String(report.skipped),
    failed: String(report.failed.length),
    cost: report.costUsd.toFixed(2),
    sanity: String(report.sanity.written),
  });
  redirect(`/${locale}/admin?${params}`);
}

/** Saves an open question's sanity test settings. */
export async function saveSanitySettings(form: FormData) {
  await requireAdmin();
  const locale = localeOf(form);
  const id = Number(form.get("id"));
  if (!Number.isInteger(id)) return;
  const db = await getDb();
  const [q] = await db.select().from(schema.questions).where(eq(schema.questions.id, id));
  if (!q || (q.status !== "open" && q.status !== "locked")) return;
  const sanity = sanityFields(form, q);
  await db
    .update(schema.questions)
    .set({ eventByDeadline: sanity.eventByDeadline, title: sanity.title, criteria: sanity.criteria })
    .where(eq(schema.questions.id, id));
  revalidatePath(`/${locale}`, "layout");
}

/** Starts the sanity test of one question now, outside the daily quota, and runs as much of it as fits. */
export async function runSanityNow(form: FormData) {
  await requireAdmin();
  const locale = localeOf(form);
  const id = Number(form.get("id"));
  if (!Number.isInteger(id)) return;
  const db = await getDb();
  const [q] = await db.select().from(schema.questions).where(eq(schema.questions.id, id));
  if (!q || !isSanityTestable(q, new Date())) redirect(`/${locale}/admin?sanityError=1`);
  const report = await runSanityTestNow(id, { maxCalls: 60 });
  revalidatePath(`/${locale}`, "layout");
  const params = new URLSearchParams({
    sanityTests: String(report.sanity.tests),
    sanityWritten: String(report.sanity.written),
    sanityFailed: String(report.failed.length),
    sanityCost: report.costUsd.toFixed(2),
  });
  redirect(`/${locale}/admin?${params}`);
}
