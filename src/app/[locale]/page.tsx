import Link from "next/link";
import { Bar } from "@/components/Bar";
import { AskIcon, DecideIcon, ForecastIcon } from "@/components/Icons";
import { QuestionCard } from "@/components/QuestionCard";
import { localeFrom } from "@/i18n";
import { getLeaderboard, listQuestions } from "@/lib/data";
import { categories } from "@/lib/site";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, t } = localeFrom((await params).locale);
  const [open, resolved, board] = await Promise.all([
    listQuestions(locale, ["open"]),
    listQuestions(locale, ["resolved"]),
    getLeaderboard(locale, "closed"),
  ]);

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
      <section className="hero" style={featured ? undefined : { gridTemplateColumns: "minmax(0, 1fr)", maxWidth: "44rem" }}>
        <div>
          <h1>{t.home.heroTitle}</h1>
          <p className="lead" style={{ marginTop: "1.1rem" }}>
            {t.home.heroBody}
          </p>
          <div className="hero-actions">
            <Link className="btn big" href={`/${locale}/suggest`}>
              {t.home.heroCta}
            </Link>
            <Link className="btn big quiet" href={`/${locale}/questions`}>
              {t.home.heroSecondary}
            </Link>
          </div>
        </div>
        {featured && (
          <div>
            <p className="small muted" style={{ marginBottom: "0.6rem" }}>
              {t.ui.featured}
            </p>
            <QuestionCard view={featured} t={t} locale={locale} feature />
          </div>
        )}
      </section>

      <section className="section" aria-label={t.ui.stepsTitle}>
        <ol className="steps" style={{ listStyle: "none", padding: 0 }}>
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

      <section className="section">
        <div className="section-head">
          <h2>{t.home.openTitle}</h2>
          <Link className="link" href={`/${locale}/questions`}>
            {t.home.seeAll}
          </Link>
        </div>
        <nav className="pills" aria-label={t.ui.exploreTitle} style={{ marginBottom: "1.25rem" }}>
          {categories.map((c) => (
            <Link key={c} className="pill" href={`/${locale}/questions?topic=${c}`}>
              {t.category[c]}
            </Link>
          ))}
        </nav>
        {rest.length === 0 && !featured ? (
          <p className="muted">{t.questions.empty}</p>
        ) : (
          <div className="grid">
            {rest.map((v) => (
              <QuestionCard key={v.question.id} view={v} t={t} locale={locale} />
            ))}
          </div>
        )}
      </section>

      {top.length > 0 && (
        <section className="section">
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
          <div className="rows">
            {top.map((r, i) => (
              <div className="row" key={r.id}>
                <div className="row-static">
                  <Link className="row-name model-name" href={`/${locale}/models/${r.id}`}>
                    <span className={`rank ${i === 0 ? "first" : ""}`}>{i + 1}</span>
                    {r.model!.name}
                  </Link>
                  <Bar value={Math.max(0, r.score) / 100} label={`${r.score.toFixed(1)}`} />
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
        <section className="section">
          <div className="section-head">
            <h2>{t.home.resolvedTitle}</h2>
            <Link className="link" href={`/${locale}/questions?status=resolved`}>
              {t.home.seeAll}
            </Link>
          </div>
          <div className="grid">
            {recent.map((v) => (
              <QuestionCard key={v.question.id} view={v} t={t} locale={locale} />
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <div className="cta-band">
          <div>
            <h2>{t.ui.ctaTitle}</h2>
            <p>{t.ui.ctaBody}</p>
          </div>
          <Link className="btn big" href={`/${locale}/suggest`}>
            {t.home.heroCta}
          </Link>
        </div>
      </section>
    </>
  );
}
