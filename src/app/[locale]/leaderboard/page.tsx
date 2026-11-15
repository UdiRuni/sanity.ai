import type { Metadata } from "next";
import Link from "next/link";
import { fill, localeFrom } from "@/i18n";
import { getLeaderboard } from "@/lib/data";
import { MIN_RESOLVED_FOR_RANK } from "@/lib/scoring";
import { tracks, type Track } from "@/lib/site";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ track?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { t } = localeFrom((await params).locale);
  return { title: t.board.title };
}

export default async function LeaderboardPage({ params, searchParams }: Props) {
  const { locale, t } = localeFrom((await params).locale);
  const track: Track = (await searchParams).track === "open" ? "open" : "closed";
  const board = await getLeaderboard(locale, track);

  // One shared axis for every row, so the whiskers can be compared by eye.
  const lows = board.rows.map((r) => r.scoreLow ?? r.score);
  const axisMin = Math.min(0, Math.floor(Math.min(...lows, 0) / 10) * 10);
  const axisMax = 100;
  const x = (v: number) => `${((Math.min(axisMax, Math.max(axisMin, v)) - axisMin) / (axisMax - axisMin)) * 100}%`;

  let rank = 0;

  return (
    <>
      <h1>{t.board.title}</h1>
      <p className="lead" style={{ marginTop: "0.8rem" }}>
        {t.board.lead}
      </p>

      <nav className="tabs" aria-label={t.board.title}>
        {tracks.map((tr) => (
          <Link
            key={tr}
            className="tab"
            href={`/${locale}/leaderboard?track=${tr}`}
            aria-current={tr === track ? "page" : undefined}
          >
            {t.track[tr]}
          </Link>
        ))}
      </nav>
      <p className="muted small">{track === "closed" ? t.track.closedHint : t.track.openHint}</p>

      {board.rows.length === 0 ? (
        <p className="muted" style={{ marginTop: "1.5rem" }}>
          {t.board.empty}
        </p>
      ) : (
        <>
          <div className="table-wrap" style={{ marginTop: "1.25rem" }}>
            <table className="data">
              <thead>
                <tr>
                  <th>{t.board.rank}</th>
                  <th>{t.question.model}</th>
                  <th className="num">{t.board.score}</th>
                  <th>
                    {t.board.interval} ({axisMin} {locale === "he" ? "עד" : "to"} {axisMax})
                  </th>
                  <th className="num">{t.board.relative}</th>
                  <th className="num">{t.board.resolved}</th>
                </tr>
              </thead>
              <tbody>
                {board.rows.map((r) => {
                  const isPanel = r.id === "panel";
                  const label = isPanel ? "" : r.ranked ? String(++rank) : t.board.warmup;
                  return (
                    <tr key={r.id} className={isPanel ? "panel" : undefined}>
                      <td>{label}</td>
                      <td>
                        {r.model ? (
                          <Link className="model-name" href={`/${locale}/models/${r.id}`}>
                            <span className="swatch" style={{ background: r.model.color }} />
                            {r.model.name}
                          </Link>
                        ) : (
                          <span className="model-name">{t.board.panel}</span>
                        )}
                      </td>
                      <td className="num">
                        <strong dir="ltr">{r.score.toFixed(1)}</strong>
                      </td>
                      <td>
                        <div
                          className="whisker"
                          role="img"
                          aria-label={
                            r.scoreLow !== null && r.scoreHigh !== null
                              ? `${r.score.toFixed(1)} (${r.scoreLow.toFixed(1)} - ${r.scoreHigh.toFixed(1)})`
                              : r.score.toFixed(1)
                          }
                          title={
                            r.scoreLow !== null && r.scoreHigh !== null
                              ? `${r.scoreLow.toFixed(1)} - ${r.scoreHigh.toFixed(1)}`
                              : undefined
                          }
                        >
                          <div className="whisker-axis" />
                          <div className="whisker-zero" style={{ left: x(0) }} />
                          {r.scoreLow !== null && r.scoreHigh !== null && (
                            <div
                              className="whisker-range"
                              style={{ left: x(r.scoreLow), right: `calc(100% - ${x(r.scoreHigh)})` }}
                            />
                          )}
                          <div className="whisker-point" style={{ left: x(r.score) }} />
                        </div>
                      </td>
                      <td className="num">
                        <span dir="ltr">
                          {isPanel ? "" : `${r.relative >= 0 ? "+" : ""}${(r.relative * 100).toFixed(1)}`}
                        </span>
                      </td>
                      <td className="num">{r.resolved}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="prose small muted" style={{ marginTop: "1.25rem" }}>
            <p>{fill(t.board.basedOn, { n: board.resolvedQuestions })}</p>
            <p>{t.board.overlapNote}</p>
            <p>{fill(t.board.warmupNote, { n: MIN_RESOLVED_FOR_RANK })}</p>
          </div>
        </>
      )}
    </>
  );
}
