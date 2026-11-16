import type { Metadata } from "next";
import Link from "next/link";
import { Bar } from "@/components/Bar";
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
  const hasMarket = board.marketQuestions > 0;
  let rank = 0;

  const signed = (v: number) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}`;

  return (
    <>
      <h1>{t.board.title}</h1>
      <p className="lead" style={{ marginTop: "0.8rem" }}>
        {t.board.lead}
      </p>

      <nav className="pills" aria-label={t.board.title} style={{ marginTop: "1.5rem" }}>
        {tracks.map((tr) => (
          <Link
            key={tr}
            className="pill"
            href={`/${locale}/leaderboard?track=${tr}`}
            aria-current={tr === track ? "page" : undefined}
          >
            {t.track[tr]}
          </Link>
        ))}
      </nav>
      <p className="muted small" style={{ marginTop: "0.6rem" }}>
        {track === "closed" ? t.track.closedHint : t.track.openHint}
      </p>

      {board.rows.length === 0 ? (
        <p className="panel soft" style={{ marginTop: "1.5rem" }}>
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
                  <th style={{ minWidth: 220 }}>{t.board.score}</th>
                  <th className="num">{t.ui.range}</th>
                  {hasMarket && (
                    <th className="num" title={t.ui.vsMarketHint}>
                      {t.ui.vsMarket}
                    </th>
                  )}
                  <th className="num">{t.board.resolved}</th>
                </tr>
              </thead>
              <tbody>
                {board.rows.map((r) => {
                  const special = r.id === "panel" || r.id === "market";
                  const place = special ? null : r.ranked ? ++rank : null;
                  return (
                    <tr key={r.id} className={special ? "special" : undefined}>
                      <td>
                        {place !== null ? (
                          <span className={`rank ${place === 1 ? "first" : ""}`}>{place}</span>
                        ) : special ? (
                          ""
                        ) : (
                          <span className="chip">{t.board.warmup}</span>
                        )}
                      </td>
                      <td>
                        {r.model ? (
                          <Link className="model-name" href={`/${locale}/models/${r.id}`}>
                            {r.model.name}
                          </Link>
                        ) : (
                          <span className="model-name">{r.id === "market" ? t.ui.marketFull : t.board.panel}</span>
                        )}
                      </td>
                      <td>
                        <div className="score-cell">
                          <strong dir="ltr">{r.score.toFixed(1)}</strong>
                          <Bar
                            value={Math.max(0, r.score) / 100}
                            tone={r.id === "market" ? "market" : "brand"}
                            label={`${r.score.toFixed(1)}`}
                          />
                        </div>
                      </td>
                      <td className="num muted small">
                        {r.scoreLow !== null && r.scoreHigh !== null && (
                          <span dir="ltr">
                            {r.scoreLow.toFixed(0)} - {r.scoreHigh.toFixed(0)}
                          </span>
                        )}
                      </td>
                      {hasMarket && (
                        <td className="num">
                          {r.vsMarket !== null && r.model && (
                            <strong dir="ltr" style={{ color: r.vsMarket >= 0 ? "var(--yes)" : "var(--no)" }}>
                              {signed(r.vsMarket)}
                            </strong>
                          )}
                        </td>
                      )}
                      <td className="num">{r.resolved}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="prose small muted" style={{ marginTop: "1.25rem" }}>
            <p>{fill(t.board.basedOn, { n: board.resolvedQuestions })}</p>
            {hasMarket && (
              <p>
                {t.ui.vsMarketHint} {fill(t.ui.marketBasedOn, { n: board.marketQuestions })}
              </p>
            )}
            <p>{t.board.overlapNote}</p>
            <p>{fill(t.board.warmupNote, { n: MIN_RESOLVED_FOR_RANK })}</p>
          </div>
        </>
      )}
    </>
  );
}
