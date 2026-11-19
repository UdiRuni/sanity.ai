import Link from "next/link";
import { Bar } from "@/components/Bar";
import { CtaBand } from "@/components/CtaBand";
import { Dot } from "@/components/Dot";
import { Helix } from "@/components/Helix";
import { AskIcon, DecideIcon, ForecastIcon } from "@/components/Icons";
import { QuestionCard } from "@/components/QuestionCard";
import { ContradictionCard } from "@/components/Sanity";
import { localeFrom } from "@/i18n";
import { toneClass } from "@/lib/colors";
import { biggestContradiction, getLeaderboard, getSanityBoard, listQuestions } from "@/lib/data";
import { categories } from "@/lib/site";
import { now } from "@/lib/time";

const MEDALS = ["first", "second", "third"];

const WEEK = 7 * 24 * 60 * 60 * 1000;

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, t } = localeFrom((await params).locale);
  const [open, resolved, board, sanityBoard] = await Promise.all([
    listQuestions(locale, ["open"]),
    listQuestions(locale, ["resolved"]),
    getLeaderboard(locale, "closed"),
    getSanityBoard(locale),
  ]);
  // The week's biggest contradiction; before there is one, the biggest so far.
  const weekly = biggestContradiction(sanityBoard.entries, new Date(now().getTime() - WEEK));
  const caught = weekly ?? biggestContradiction(sanityBoard.entries);

  // The featured card is live data: the open question the models disagree on most.
  const featured = [...open].sort((a, b) => b.spread - a.spread)[0];
  const rest = open.filter((v) => v !== featured).slice(0, 6);
  const recent = [...resolved]
    .sort((a, b) => (b.question.resolvedAt?.getTime() ?? 0) - (a.question.resolvedAt?.getTime() ?? 0))
    .slice(0, 3);
  const top = board.rows.filter((r) => r.model && r.ranked).slice(0, 3);
  const icons = [<AskIcon key="a" />, <ForecastIcon key="f" />, <DecideIcon key="d" />];

  return (
    <>
      <section className="hero-band bleed">
        <div className="hero" style={featured ? undefined : { gridTemplateColumns: "minmax(0, 1fr)", maxWidth: "44rem" }}>
          <div className="cascade">
            <h1>{t.home.heroTitle}</h1>
            <p className="lead" style={{ marginTop: "1.1rem" }}>
              {t.home.heroBody}
            </p>
            <div className="hero-actions">
              <Link className="btn big amber" href={`/${locale}/suggest`}>
                {t.home.heroCta}
              </Link>
              <Link className="btn big on-night" href={`/${locale}/questions`}>
                {t.home.heroSecondary}
              </Link>
            </div>
          </div>
          {featured && (
            <div className="cascade">
              <p className="small featured-label" style={{ marginBottom: "0.6rem" }}>
                {t.ui.featured}
              </p>
              <QuestionCard view={featured} t={t} locale={locale} feature />
            </div>
          )}
        </div>
        <Helix />
      </section>

      <section className="section" aria-label={t.ui.stepsTitle}>
        <ol className="steps cascade" style={{ listStyle: "none", padding: 0 }}>
          {t.ui.steps.map((s, i) => (
            <li className="step" key={s.h}>
              <div className="step-icon">{icons[i]}</div>
              <h3>
                {i + 1}. {s.h}
              </h3>
              <p>{s.p}</p>
            </li>
          ))}
        </ol>
      </section>

      {caught && (
        <section className="section reveal">
          <div className="section-head">
            <div>
              <h2>{weekly ? t.sanity.worstWeek : t.sanity.worstEver}</h2>
              <p className="muted" style={{ marginTop: "0.25rem" }}>
                {t.sanity.worstBody}
              </p>
            </div>
            <Link className="link" href={`/${locale}/leaderboard?track=sanity`}>
              {t.sanity.seeBoard}
            </Link>
          </div>
          <div style={{ maxWidth: "46rem" }}>
            <ContradictionCard
              r={caught.result}
              modelName={caught.model.name}
              modelId={caught.model.id}
              ctx={{ t, locale, question: caught.question, test: caught.test }}
              feature
              night
            />
          </div>
        </section>
      )}

      <section className="section reveal">
        <div className="section-head">
          <h2>{t.home.openTitle}</h2>
          <Link className="link" href={`/${locale}/questions`}>
            {t.home.seeAll}
          </Link>
        </div>
        <nav className="pills" aria-label={t.ui.exploreTitle} style={{ marginBottom: "1.25rem" }}>
          {categories.map((c) => (
            <Link key={c} className={`pill ${toneClass(c)}`} href={`/${locale}/questions?topic=${c}`}>
              {t.category[c]}
            </Link>
          ))}
        </nav>
        {rest.length === 0 && !featured ? (
          <p className="muted">{t.questions.empty}</p>
        ) : (
          <div className="grid cascade">
            {rest.map((v) => (
              <QuestionCard key={v.question.id} view={v} t={t} locale={locale} />
            ))}
          </div>
        )}
      </section>

      {top.length > 0 && (
        <section className="section reveal">
          <div className="section-head">
            <div>
              <h2>{t.ui.bestTitle}</h2>
              <p className="muted" style={{ marginTop: "0.25rem" }}>
                {t.ui.bestBody}
              </p>
            </div>
            <Link className="link" href={`/${locale}/leaderboard`}>
              {t.home.seeBoard}
            </Link>
          </div>
          <div className="rows cascade">
            {top.map((r, i) => (
              <div className="row" key={r.id}>
                <div className="row-static">
                  <Link className="row-name model-name" href={`/${locale}/models/${r.id}`}>
                    <span className={`rank ${MEDALS[i] ?? ""}`}>{i + 1}</span>
                    <Dot color={r.model!.color} />
                    {r.model!.name}
                  </Link>
                  <Bar value={Math.max(0, r.score) / 100} label={`${r.score.toFixed(1)}`} color={r.model!.color} index={i} />
                  <span className="row-value" dir="ltr">
                    {r.score.toFixed(0)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section className="section reveal">
          <div className="section-head">
            <h2>{t.home.resolvedTitle}</h2>
            <Link className="link" href={`/${locale}/questions?status=resolved`}>
              {t.home.seeAll}
            </Link>
          </div>
          <div className="grid cascade">
            {recent.map((v) => (
              <QuestionCard key={v.question.id} view={v} t={t} locale={locale} />
            ))}
          </div>
        </section>
      )}

      <CtaBand t={t} locale={locale} />
    </>
  );
}
