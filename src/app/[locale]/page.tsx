import Link from "next/link";
import { QuestionMeta, QuestionRow } from "@/components/QuestionRow";
import { Rail } from "@/components/Rail";
import { localeFrom, pct } from "@/i18n";
import { getLeaderboard, listQuestions, pick } from "@/lib/data";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, t } = localeFrom((await params).locale);
  const [open, resolved, board] = await Promise.all([
    listQuestions(locale, ["open"]),
    listQuestions(locale, ["resolved"]),
    getLeaderboard(locale, "closed"),
  ]);

  // The hero is live data: the open question the models disagree on most.
  const dispute = [...open].sort((a, b) => b.spread - a.spread)[0];
  const rest = open.filter((v) => v !== dispute).slice(0, 5);
  const recent = [...resolved]
    .sort((a, b) => (b.question.resolvedAt?.getTime() ?? 0) - (a.question.resolvedAt?.getTime() ?? 0))
    .slice(0, 3);
  const top = board.rows.filter((r) => r.model && r.ranked).slice(0, 5);

  return (
    <>
      <section className="hero">
        <div>
          <h1>{t.home.heroTitle}</h1>
          <p className="lead" style={{ marginTop: "1.1rem" }}>
            {t.home.heroBody}
          </p>
          <div className="hero-actions">
            <Link className="btn" href={`/${locale}/suggest`}>
              {t.home.heroCta}
            </Link>
            <Link className="btn quiet" href={`/${locale}/questions`}>
              {t.home.heroSecondary}
            </Link>
          </div>
        </div>

        {dispute && (
          <div className="panel">
            <p className="small muted">{t.home.disputeTitle}</p>
            <h2 style={{ marginTop: "0.4rem", fontSize: "1.5rem" }}>
              <Link
                href={`/${locale}/questions/${dispute.question.slug}`}
                style={{ textDecoration: "none" }}
              >
                {pick(dispute.question.title, locale, dispute.question.lang)}
              </Link>
            </h2>
            <div style={{ marginTop: "0.6rem" }}>
              <QuestionMeta question={dispute.question} t={t} locale={locale} />
            </div>
            <div style={{ marginTop: "1.4rem" }}>
              <Rail
                t={t}
                size="lg"
                median={dispute.median}
                items={dispute.latest.map((l) => ({
                  id: l.model.id,
                  name: l.model.name,
                  color: l.model.color,
                  p: l.forecast.probability,
                }))}
              />
            </div>
            <div className="legend">
              {[...dispute.latest]
                .sort((a, b) => b.forecast.probability - a.forecast.probability)
                .map((l) => (
                  <div className="legend-item" key={l.model.id}>
                    <span>
                      <span className="swatch" style={{ background: l.model.color }} />
                      {l.model.name}
                    </span>
                    <strong>{pct(l.forecast.probability)}</strong>
                  </div>
                ))}
            </div>
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <h2>{t.home.openTitle}</h2>
          <Link className="link" href={`/${locale}/questions`}>
            {t.home.seeAll}
          </Link>
        </div>
        {rest.length === 0 && !dispute ? (
          <p className="muted">{t.questions.empty}</p>
        ) : (
          <div className="q-list">
            {rest.map((v) => (
              <QuestionRow key={v.question.id} view={v} t={t} locale={locale} />
            ))}
          </div>
        )}
      </section>

      {top.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>{t.home.topTitle}</h2>
            <Link className="link" href={`/${locale}/leaderboard`}>
              {t.home.seeBoard}
            </Link>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>{t.board.rank}</th>
                  <th>{t.question.model}</th>
                  <th className="num">{t.board.score}</th>
                  <th className="num">{t.board.resolved}</th>
                </tr>
              </thead>
              <tbody>
                {top.map((r, i) => (
                  <tr key={r.id}>
                    <td>{i + 1}</td>
                    <td>
                      <Link className="model-name" href={`/${locale}/models/${r.id}`}>
                        <span className="swatch" style={{ background: r.model!.color }} />
                        {r.model!.name}
                      </Link>
                    </td>
                    <td className="num">
                      <strong>{r.score.toFixed(1)}</strong>
                    </td>
                    <td className="num">{r.resolved}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
          <div className="q-list">
            {recent.map((v) => (
              <QuestionRow key={v.question.id} view={v} t={t} locale={locale} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
