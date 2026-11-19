import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { checkLines, headline, sharePath, verdict, type CheckContext } from "@/components/Sanity";
import { Num } from "@/components/Num";
import { ShareButtons } from "@/components/ShareButtons";
import { fill, localeFrom, type Dictionary } from "@/i18n";
import { getQuestion, getQuestionSanity, pick } from "@/lib/data";
import { points } from "@/lib/sanity";
import { site, type Locale } from "@/lib/site";

type Props = {
  params: Promise<{ locale: string; slug: string; model: string }>;
  searchParams: Promise<{ check?: string }>;
};

/** One model's sanity result on one question, with the check to feature. */
async function load(slug: string, modelId: string, check: string | undefined, t: Dictionary, locale: Locale) {
  const view = await getQuestion(slug);
  if (!view || view.question.status === "pending" || view.question.status === "rejected") return null;
  const sanity = await getQuestionSanity(view.question, view.models);
  const result = sanity?.results.find((r) => r.model.id === modelId);
  if (!sanity || !result) return null;
  const chosen = result.checks.find((c) => c.check === check) ?? null;
  const featured = chosen ?? result.worst;
  const ctx: CheckContext = { t, locale, question: view.question, test: sanity.test };
  const allPassed = result.checks.every((c) => c.passed);
  return { view, sanity, result, featured, chosen, ctx, allPassed };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale: raw, slug, model } = await params;
  const { locale, t } = localeFrom(raw);
  const data = await load(slug, model, (await searchParams).check, t, locale);
  if (!data) return {};
  const title =
    data.allPassed && !data.chosen
      ? fill(t.sanity.allPassed, { model: data.result.model.name })
      : headline(data.featured, data.result.model.name, data.ctx);
  const description = `${pick(data.view.question.title, locale, data.view.question.lang)} ${t.sanity.name}, ${site.name}.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "article", siteName: site.name },
    twitter: { card: "summary", title, description },
  };
}

export default async function SanitySharePage({ params, searchParams }: Props) {
  const { locale: raw, slug, model } = await params;
  const { locale, t } = localeFrom(raw);
  const data = await load(slug, model, (await searchParams).check, t, locale);
  if (!data) notFound();
  const { view, result, featured, ctx, allPassed, chosen } = data;
  const q = view.question;
  const name = result.model.name;
  const text = allPassed && !chosen ? fill(t.sanity.allPassed, { model: name }) : headline(featured, name, ctx);

  // Share links need the page's absolute address, which only the request knows.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const path = sharePath(locale, q, result.model.id, featured.check);
  const url = host ? `${proto}://${host}${path}` : path;

  const others = result.checks.filter((c) => c.check !== featured.check);

  return (
    <article style={{ maxWidth: "46rem", marginInline: "auto" }}>
      <div className="meta">
        <span className="chip violet">{t.sanity.name}</span>
        <span>{t.sanity.checks[featured.check]}</span>
        {!featured.passed && <span>{t.sanity.caught}</span>}
      </div>
      <h1 className="sanity-headline" style={{ marginTop: "0.9rem" }}>
        {text}
      </h1>

      <section className="card feature sanity-card" style={{ marginTop: "1.5rem" }}>
        <div className="card-figure">
          {featured.check === "negation" ? (
            <>
              <span className="figure big">
                <Num value={(featured.a + featured.b) * 100} suffix="%" />
              </span>
              <span className="figure-label">{t.sanity.instead100}</span>
            </>
          ) : (
            <>
              <span className="figure big">
                <Num value={points(featured.contradiction)} />
              </span>
              <span className="figure-label">{t.sanity.size}</span>
            </>
          )}
        </div>
        <p className="check-values">
          {checkLines(featured, ctx).map((line) => (
            <span key={line}>{line}</span>
          ))}
        </p>
        <p className="small muted">{t.sanity.checkHints[featured.check]}</p>
      </section>

      {!featured.passed && (
        <p className="lead" style={{ marginTop: "1.5rem" }}>
          {fill(t.sanity.money, { model: name, n: points(featured.contradiction) })}
        </p>
      )}

      <div style={{ marginTop: "1.5rem" }}>
        <ShareButtons
          url={url}
          text={text}
          labels={{
            share: t.sanity.share,
            whatsapp: t.sanity.whatsapp,
            x: t.sanity.x,
            copy: t.sanity.copy,
            copied: t.sanity.copied,
          }}
        />
      </div>

      <div className="panel soft" style={{ marginTop: "2rem" }}>
        <p>
          <Link className="link" href={`/${locale}/questions/${q.slug}#sanity`}>
            {pick(q.title, locale, q.lang)}
          </Link>
        </p>
        <p className="small muted" style={{ marginTop: "0.4rem" }}>
          {t.question.criteria}: {pick(q.criteria, locale, q.lang)}
        </p>
      </div>

      {others.length > 0 && (
        <section className="section" style={{ marginTop: "2.5rem" }}>
          <h2>{t.sanity.otherChecks}</h2>
          <ul className="check-list" style={{ marginTop: "1rem" }}>
            {others.map((r) => (
              <li key={r.check}>
                <div className="check-head">
                  <Link className="link" href={sharePath(locale, q, result.model.id, r.check)}>
                    {t.sanity.checks[r.check]}
                  </Link>
                  <span className={`chip ${r.passed ? "yes" : "no"}`}>
                    <span aria-hidden="true">{r.passed ? "✓" : "✕"}</span>
                    {verdict(r, t)}
                  </span>
                </div>
                <p className="check-values">
                  {checkLines(r, ctx).map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="hero-actions" style={{ marginTop: "2.5rem" }}>
        <Link className="btn" href={`/${locale}/leaderboard?track=sanity`}>
          {t.sanity.seeBoard}
        </Link>
        <Link className="btn quiet" href={`/${locale}/questions/${q.slug}`}>
          {t.sanity.seeQuestion}
        </Link>
      </div>
      <p className="small muted" style={{ marginTop: "1.5rem" }}>
        {t.sanity.necessaryNote}
      </p>
    </article>
  );
}
