import type { Metadata } from "next";
import Link from "next/link";
import { sanity as sanitySettings } from "../../../../sanity.config";
import { Bar } from "@/components/Bar";
import { fill, localeFrom, type Dictionary } from "@/i18n";
import { getLeaderboard, getSanityBoard } from "@/lib/data";
import { allChecks, points } from "@/lib/sanity";
import { MIN_RESOLVED_FOR_RANK } from "@/lib/scoring";
import { tracks, type Locale, type Track } from "@/lib/site";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ track?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { t } = localeFrom((await params).locale);
  return { title: t.board.title };
}

/** The accuracy tracks, then the sanity board. */
function BoardPills({ locale, t, current }: { locale: Locale; t: Dictionary; current: Track | "sanity" }) {
  return (
    <nav className="pills" aria-label={t.board.title} style={{ marginTop: "1.5rem" }}>
      {tracks.map((tr) => (
        <Link
          key={tr}
          className="pill"
          href={`/${locale}/leaderboard?track=${tr}`}
          aria-current={tr === current ? "page" : undefined}
        >
          {t.track[tr]}
        </Link>
      ))}
      <Link
        className="pill"
        href={`/${locale}/leaderboard?track=sanity`}
        aria-current={current === "sanity" ? "page" : undefined}
      >
        {t.sanity.name}
      </Link>
    </nav>
  );
}

async function SanityBoardView({ locale, t }: { locale: Locale; t: Dictionary }) {
  const board = await getSanityBoard(locale);
  const checks = allChecks.filter((c) => sanitySettings.checks.includes(c));
  let rank = 0;
  return (
    <>
      <h1>{t.board.title}</h1>
      <p className="lead" style={{ marginTop: "0.8rem" }}>
        {t.sanity.boardLead}
      </p>
      <BoardPills locale={locale} t={t} current="sanity" />
      <p className="muted small" style={{ marginTop: "0.6rem" }}>
        {t.sanity.scoreNote}
      </p>

      {board.rows.length === 0 ? (
        <p className="panel soft" style={{ marginTop: "1.5rem" }}>
          {t.sanity.empty}
        </p>
      ) : (
        <>
          <div className="table-wrap" style={{ marginTop: "1.25rem" }}>
            <table className="data">
              <thead>
                <tr>
                  <th>{t.board.rank}</th>
                  <th>{t.question.model}</th>
                  <th style={{ minWidth: 200 }}>{t.sanity.score}</th>
                  <th className="num">{t.ui.range}</th>
                  {checks.map((c) => (
                    <th key={c} className="num" title={`${t.sanity.avg}. ${t.sanity.checkHints[c]}`}>
                      {t.sanity.checks[c]}
                    </th>
                  ))}
                  <th className="num">{t.sanity.checksCount}</th>
                </tr>
              </thead>
              <tbody>
                {board.rows.map((r) => {
                  const place = r.ranked ? ++rank : null;
                  return (
                    <tr key={r.model.id}>
                      <td>
                        {place !== null ? (
                          <span className={`rank ${place === 1 ? "first" : ""}`}>{place}</span>
                        ) : (
                          <span className="chip">{t.board.warmup}</span>
                        )}
                      </td>
                      <td>
                        <Link className="model-name" href={`/${locale}/models/${r.model.id}#sanity`}>
                          {r.model.name}
                        </Link>
                      </td>
                      <td>
                        <div className="score-cell">
                          <strong dir="ltr">{r.score.toFixed(1)}</strong>
                          <Bar value={Math.max(0, r.score) / 100} label={r.score.toFixed(1)} />
                        </div>
                      </td>
                      <td className="num muted small">
                        {r.scoreLow !== null && r.scoreHigh !== null && (
                          <span dir="ltr">
                            {r.scoreLow.toFixed(0)} - {r.scoreHigh.toFixed(0)}
                          </span>
                        )}
                      </td>
                      {checks.map((c) => {
                        const cell = r.byCheck[c];
                        return (
                          <td key={c} className="num">
                            {cell && (
                              <span title={`${t.sanity.avg}, ${cell.n} ${t.sanity.checksCount}`}>{points(cell.mean)}</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="num">{r.checks}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="prose small muted" style={{ marginTop: "1.25rem" }}>
            <p>{fill(t.sanity.basedOn, { checks: board.checks, tests: board.tests })}</p>
            <p>{t.sanity.avg}:</p>
            <ul className="check-defs">
              {checks.map((c) => (
                <li key={c}>
                  <strong>{t.sanity.checks[c]}</strong>: {t.sanity.checkHints[c]}
                </li>
              ))}
            </ul>
            <p>{t.sanity.necessaryNote}</p>
            <p>{t.sanity.noiseNote}</p>
            <p>{fill(t.sanity.warmupNote, { n: sanitySettings.minChecksForRank })}</p>
          </div>
        </>
      )}
    </>
  );
}

export default async function LeaderboardPage({ params, searchParams }: Props) {
  const { locale, t } = localeFrom((await params).locale);
  const requested = (await searchParams).track;
  if (requested === "sanity") return <SanityBoardView locale={locale} t={t} />;
  const track: Track = requested === "open" ? "open" : "closed";
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

      <BoardPills locale={locale} t={t} current={track} />
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
