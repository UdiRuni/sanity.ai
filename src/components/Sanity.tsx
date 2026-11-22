import Link from "next/link";
import type { Question, SanityTest } from "@/db/schema";
import { fill, formatDate, pct, type Dictionary } from "@/i18n";
import { pick, type QuestionSanity } from "@/lib/data";
import { points, type CheckResult } from "@/lib/sanity";
import type { Locale } from "@/lib/site";
import { Dot } from "./Dot";
import { Num } from "./Num";

/** What a check description needs to know about where it was asked. */
export type CheckContext = { t: Dictionary; locale: Locale; question: Question; test: SanityTest };

function langName(t: Dictionary, lang: string | null): string {
  return (lang && t.sanity.langNames[lang]) || lang || "";
}

/** The two answers of a check, as short lines of text. */
export function checkLines(r: CheckResult, { t, locale, question, test }: CheckContext): string[] {
  switch (r.check) {
    case "negation":
      return [fill(t.sanity.yes, { p: pct(r.a) }), fill(t.sanity.no, { p: pct(r.b) }), fill(t.sanity.total, { p: pct(r.a + r.b) })];
    case "deadline":
      return [
        fill(t.sanity.by, { date: formatDate(test.earlierBy, locale), p: pct(r.a) }),
        fill(t.sanity.by, { date: formatDate(question.resolveBy, locale), p: pct(r.b) }),
      ];
    case "language":
      return [
        fill(t.sanity.inLang, { lang: langName(t, question.lang), p: pct(r.a) }),
        fill(t.sanity.inLang, { lang: langName(t, test.translateTo), p: pct(r.b) }),
      ];
    case "sycophancy":
      return [fill(t.sanity.leanYes, { p: pct(r.a) }), fill(t.sanity.leanNo, { p: pct(r.b) })];
  }
}

/** "Consistent", or how big the contradiction is. */
export function verdict(r: CheckResult, t: Dictionary): string {
  if (r.passed) return t.sanity.pass;
  // For sycophancy the size and the direction are one number: say which way it moved.
  if (r.check === "sycophancy" && r.shift !== undefined && r.shift !== 0) {
    return fill(r.shift > 0 ? t.sanity.toward : t.sanity.away, { n: Math.abs(points(r.shift)) });
  }
  return fill(t.sanity.fail, { n: points(r.contradiction) });
}

/** One sentence that tells the whole story, for the share page and cards. */
export function headline(r: CheckResult, modelName: string, ctx: CheckContext): string {
  const { t, locale, question, test } = ctx;
  if (r.passed) return fill(t.sanity.passedHeadline, { model: modelName, check: t.sanity.checkTitles[r.check] });
  switch (r.check) {
    case "negation":
      return fill(t.sanity.headline.negation, { model: modelName, a: pct(r.a), b: pct(r.b), sum: pct(r.a + r.b) });
    case "deadline":
      return fill(t.sanity.headline.deadline, {
        model: modelName,
        a: pct(r.a),
        b: pct(r.b),
        early: formatDate(test.earlierBy, locale),
        late: formatDate(question.resolveBy, locale),
      });
    case "language":
      return fill(t.sanity.headline.language, {
        model: modelName,
        a: pct(r.a),
        b: pct(r.b),
        langA: langName(t, question.lang),
        langB: langName(t, test.translateTo),
      });
    case "sycophancy":
      return fill(t.sanity.headline.sycophancy, { model: modelName, a: pct(r.a), b: pct(r.b) });
  }
}

/** A check as a chip. The mark carries the meaning, so it is not color alone. */
export function CheckChip({ r, t }: { r: CheckResult; t: Dictionary }) {
  return (
    <span className={`chip ${r.passed ? "yes" : "no"}`}>
      <span aria-hidden="true">{r.passed ? "✓" : "✕"}</span>
      {t.sanity.checks[r.check]}
      {!r.passed && <span style={{ fontWeight: 500 }}>{fill(t.sanity.pts, { n: points(r.contradiction) })}</span>}
    </span>
  );
}

export function sharePath(locale: Locale, question: Question, modelId: string, check?: string): string {
  return `/${locale}/questions/${question.slug}/sanity/${modelId}${check ? `?check=${check}` : ""}`;
}

/** The sanity check section of a question page. */
export function SanitySection({
  sanity,
  question,
  t,
  locale,
}: {
  sanity: QuestionSanity;
  question: Question;
  t: Dictionary;
  locale: Locale;
}) {
  const ctx: CheckContext = { t, locale, question, test: sanity.test };
  return (
    <section className="section" id="sanity" aria-labelledby="sanity-title">
      <div className="section-head">
        <div>
          <h2 id="sanity-title" style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <span className="chip violet" aria-hidden="true">
              ✓✕
            </span>
            {t.sanity.name}
          </h2>
          <p className="muted" style={{ marginTop: "0.25rem" }}>
            {t.sanity.lead}
          </p>
        </div>
        <Link className="link" href={`/${locale}/leaderboard?track=sanity`}>
          {t.sanity.seeBoard}
        </Link>
      </div>

      <div className="rows cascade">
        {sanity.results.map((res) => (
          <details className="row" key={res.model.id}>
            <summary className="sanity-summary">
              <span className="row-name">
                <span className="caret" aria-hidden="true">
                  ▸
                </span>
                <Dot color={res.model.color} />
                {res.model.name}
              </span>
              <span className="sanity-chips">
                {res.checks.map((r) => (
                  <CheckChip key={r.check} r={r} t={t} />
                ))}
              </span>
            </summary>
            <div className="row-body">
              <ul className="check-list">
                {res.checks.map((r) => (
                  <li key={r.check}>
                    <div className="check-head">
                      <strong>{t.sanity.checks[r.check]}</strong>
                      <span className={`chip ${r.passed ? "yes" : "no"}`}>
                        <span aria-hidden="true">{r.passed ? "✓" : "✕"}</span>
                        {verdict(r, t)}
                      </span>
                    </div>
                    <p className="small muted">{t.sanity.checkHints[r.check]}</p>
                    <p className="check-values">
                      {checkLines(r, ctx).map((line) => (
                        <span key={line}>{line}</span>
                      ))}
                    </p>
                  </li>
                ))}
              </ul>
              <p className="small" style={{ marginTop: "0.9rem" }}>
                <Link className="link" href={sharePath(locale, question, res.model.id)}>
                  {res.worst.passed ? t.sanity.share : t.sanity.shareThis}
                </Link>
              </p>
            </div>
          </details>
        ))}
      </div>
      <p className="small muted" style={{ marginTop: "0.9rem" }}>
        {fill(t.sanity.asked, { date: formatDate(sanity.test.askedOn, locale) })}. {t.sanity.noiseNote}
      </p>
    </section>
  );
}

/** A clickable card with one contradiction, for the home page and model pages. */
export function ContradictionCard({
  r,
  modelName,
  modelId,
  ctx,
  feature = false,
  night = false,
}: {
  r: CheckResult;
  modelName: string;
  modelId: string;
  ctx: CheckContext;
  /** The big version for the home page: the size of the contradiction as a figure. */
  feature?: boolean;
  /** On a dark card, with the number in coral. */
  night?: boolean;
}) {
  const { t, locale, question } = ctx;
  const Heading = feature ? "h2" : "h3";
  return (
    <article className={`card sanity-card ${feature ? "feature" : ""} ${night ? "night" : ""}`}>
      <div className="meta">
        <CheckChip r={r} t={t} />
        <span>{t.sanity.caught}</span>
      </div>
      <Heading className="card-title" style={feature ? { fontSize: "1.45rem" } : undefined}>
        <Link className="card-link" href={sharePath(locale, question, modelId, r.check)}>
          {headline(r, modelName, ctx)}
        </Link>
      </Heading>
      {feature && (
        <div className="card-figure">
          {r.check === "negation" ? (
            <>
              <span className="figure big">
                <Num value={(r.a + r.b) * 100} suffix="%" />
              </span>
              <span className="figure-label">{t.sanity.instead100}</span>
            </>
          ) : (
            <>
              <span className="figure big">
                <Num value={points(r.contradiction)} />
              </span>
              <span className="figure-label">{t.sanity.size}</span>
            </>
          )}
        </div>
      )}
      <p className="small muted">{pick(question.title, locale, question.lang)}</p>
      <span className="card-foot" aria-hidden="true">
        {t.sanity.shareThis}
      </span>
    </article>
  );
}
