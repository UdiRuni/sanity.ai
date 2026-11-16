import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalibrationChart } from "@/components/CalibrationChart";
import { formatDate, localeFrom, pct } from "@/i18n";
import { getModelProfile, pick } from "@/lib/data";

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw, id } = await params;
  const { locale } = localeFrom(raw);
  const profile = await getModelProfile(id, locale);
  return profile ? { title: profile.model.name } : {};
}

export default async function ModelPage({ params }: Props) {
  const { locale: raw, id } = await params;
  const { locale, t } = localeFrom(raw);
  const profile = await getModelProfile(id, locale);
  if (!profile) notFound();
  const { model } = profile;

  const list = (items: typeof profile.best) => (
    <table className="data">
      <tbody>
        {items.map((e) => (
          <tr key={e.question.id}>
            <td>
              <Link className="link" href={`/${locale}/questions/${e.question.slug}`}>
                {pick(e.question.title, locale, e.question.lang)}
              </Link>
            </td>
            <td className="num">{pct(e.final)}</td>
            <td className="num">
              <span className={`chip ${e.question.outcome ? "yes" : "no"}`}>
                <span aria-hidden="true">{e.question.outcome ? "✓" : "✕"}</span>
                {e.question.outcome ? t.outcome.yes : t.outcome.no}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <>
      <div className="meta">
        <span className="chip">{t.model.tiers[model.tier as keyof typeof t.model.tiers] ?? model.tier}</span>
        <span>
          {t.model.provider}: {model.provider}
        </span>
        <span dir="ltr">{model.apiModel}</span>
        <span>
          {t.model.since} {formatDate(model.joinedAt, locale)}
        </span>
      </div>
      <h1 style={{ marginTop: "0.8rem" }}>{model.name}</h1>

      <div className="grid" style={{ marginTop: "1.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        {profile.rows.map(({ track, row }) => (
          <div key={track} className="panel soft">
            <div className="figure" dir="ltr" style={{ textAlign: "start" }}>{row ? row.score.toFixed(1) : "?"}</div>
            <div className="figure-label">
              {t.board.score}, {t.track[track]}
              {row ? ` (${row.resolved} ${t.board.resolved})` : ""}
            </div>
          </div>
        ))}
        {profile.rank > 0 && (
          <div className="panel soft">
            <div className="figure">{profile.rank}</div>
            <div className="figure-label">
              {t.board.rank}, {t.track.closed}
            </div>
          </div>
        )}
      </div>

      <section className="section">
        <h2>{t.model.calibration}</h2>
        <p className="muted" style={{ marginTop: "0.5rem" }}>
          {t.model.calibrationLead}
        </p>
        {profile.calibration.length === 0 ? (
          <p className="muted" style={{ marginTop: "1rem" }}>
            {t.model.noData}
          </p>
        ) : (
          <div style={{ display: "flex", gap: "2.5rem", flexWrap: "wrap", alignItems: "center", marginTop: "1.25rem" }}>
            <CalibrationChart bins={profile.calibration} color="#2f5bea" t={t} />
            <div className="table-wrap" style={{ flex: "1 1 260px" }}>
              <table className="data">
                <thead>
                  <tr>
                    <th>{t.model.said}</th>
                    <th className="num">{t.model.happened}</th>
                    <th className="num">{t.model.cases}</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.calibration.map((b) => (
                    <tr key={b.from}>
                      <td>
                        <span dir="ltr">
                          {Math.round(b.from * 100)}%-{Math.round(b.to * 100)}%
                        </span>
                      </td>
                      <td className="num">{pct(b.observed)}</td>
                      <td className="num">{b.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {profile.best.length > 0 && (
        <>
          <section className="section">
            <h2>{t.model.best}</h2>
            <div className="table-wrap" style={{ marginTop: "0.75rem" }}>{list(profile.best)}</div>
          </section>
          <section className="section">
            <h2>{t.model.worst}</h2>
            <div className="table-wrap" style={{ marginTop: "0.75rem" }}>{list(profile.worst)}</div>
          </section>
        </>
      )}
    </>
  );
}
