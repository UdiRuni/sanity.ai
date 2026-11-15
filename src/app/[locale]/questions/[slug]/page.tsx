import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { QuestionMeta } from "@/components/QuestionRow";
import { Rail } from "@/components/Rail";
import { formatDate, localeFrom, pct } from "@/i18n";
import { getQuestion, latestPerModel, pick } from "@/lib/data";
import { brier } from "@/lib/scoring";
import { tracks, type Track } from "@/lib/site";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ track?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const { locale } = localeFrom(raw);
  const view = await getQuestion(slug);
  if (!view) return {};
  return { title: pick(view.question.title, locale, view.question.lang) };
}

export default async function QuestionPage({ params, searchParams }: Props) {
  const { locale: raw, slug } = await params;
  const { locale, t } = localeFrom(raw);
  const view = await getQuestion(slug);
  // Suggestions that were not approved are not public pages.
  if (!view || view.question.status === "pending" || view.question.status === "rejected") notFound();

  const q = view.question;
  const requested = (await searchParams).track;
  const track: Track = requested === "open" ? "open" : "closed";
  const latest = latestPerModel(view.forecasts, view.models, track).sort(
    (a, b) => b.forecast.probability - a.forecast.probability,
  );
  const ps = latest.map((l) => l.forecast.probability).sort((a, b) => a - b);
  const med = ps.length ? (ps.length % 2 ? ps[(ps.length - 1) / 2] : (ps[ps.length / 2 - 1] + ps[ps.length / 2]) / 2) : null;
  const resolved = q.status === "resolved" && q.outcome !== null;

  return (
    <article>
      <QuestionMeta question={q} t={t} locale={locale} />
      <h1 style={{ marginTop: "0.8rem" }}>{pick(q.title, locale, q.lang)}</h1>

      <div className="panel wash" style={{ marginTop: "1.5rem" }}>
        <p>
          <strong>{t.question.criteria}: </strong>
          {pick(q.criteria, locale, q.lang)}
        </p>
        <div className="meta" style={{ marginTop: "0.6rem" }}>
          {q.openAt && (
            <span>
              {t.question.opened} {formatDate(q.openAt, locale)}
            </span>
          )}
          {q.lockAt && !resolved && (
            <span>
              {t.question.locks} {formatDate(q.lockAt, locale)}
            </span>
          )}
          {q.sourceUrl && (
            <a className="link" href={q.sourceUrl} rel="noopener noreferrer nofollow" target="_blank">
              {t.question.source}
            </a>
          )}
          {resolved && q.resolutionUrl && (
            <a className="link" href={q.resolutionUrl} rel="noopener noreferrer nofollow" target="_blank">
              {t.question.proof}
            </a>
          )}
        </div>
      </div>

      <section className="section">
        <div className="section-head">
          <h2>{t.question.forecasts}</h2>
          <nav className="tabs" style={{ margin: 0 }} aria-label={t.question.forecasts}>
            {tracks.map((tr) => (
              <Link
                key={tr}
                className="tab"
                href={`/${locale}/questions/${q.slug}?track=${tr}`}
                aria-current={tr === track ? "page" : undefined}
                title={tr === "closed" ? t.track.closedHint : t.track.openHint}
              >
                {t.track[tr]}
              </Link>
            ))}
          </nav>
        </div>
        <p className="muted small">{track === "closed" ? t.track.closedHint : t.track.openHint}</p>

        <div style={{ display: "flex", gap: "2rem", alignItems: "end", marginTop: "1.5rem", flexWrap: "wrap" }}>
          <div>
            <div className="figure big">{med === null ? "?" : pct(med)}</div>
            <div className="figure-label">
              {t.rail.median}
              {ps.length > 1 && `, ${t.rail.range} ${pct(ps[0])} ${locale === "he" ? "עד" : "to"} ${pct(ps[ps.length - 1])}`}
            </div>
          </div>
          <div style={{ flex: "1 1 360px", minWidth: 0 }}>
            <Rail
              t={t}
              size="lg"
              median={med}
              outcome={resolved ? q.outcome : null}
              items={latest.map((l) => ({
                id: l.model.id,
                name: l.model.name,
                color: l.model.color,
                p: l.forecast.probability,
              }))}
            />
          </div>
        </div>

        <div style={{ marginTop: "2rem", borderTop: "1px solid var(--line)" }}>
          {latest.map(({ model, forecast }) => {
            const history = view.forecasts
              .filter((f) => f.modelId === model.id && f.track === track)
              .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
            return (
              <div className="forecast" key={model.id}>
                <div className="forecast-head">
                  <Link className="model-name" href={`/${locale}/models/${model.id}`}>
                    <span className="swatch" style={{ background: model.color }} />
                    {model.name}
                  </Link>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "0.9rem" }}>
                    {resolved && (
                      <span className="muted small">
                        {t.question.brier} {brier(forecast.probability, q.outcome!).toFixed(3)}
                      </span>
                    )}
                    <span className="figure" style={{ fontSize: "1.6rem" }}>
                      {pct(forecast.probability)}
                    </span>
                  </div>
                </div>
                <p>{forecast.rationale}</p>
                {forecast.keyFactors.length > 0 && (
                  <div className="factors">
                    {forecast.keyFactors.map((k) => (
                      <span className="chip" key={k}>
                        {k}
                      </span>
                    ))}
                  </div>
                )}
                {forecast.changeMind && (
                  <p className="small">
                    <strong>{t.question.changeMind}: </strong>
                    {forecast.changeMind}
                  </p>
                )}
                {forecast.sources.length > 0 && (
                  <p className="small">
                    <strong>{t.question.sources}: </strong>
                    {forecast.sources.map((s, i) => (
                      <span key={s.url}>
                        {i > 0 && ", "}
                        <a className="link" href={s.url} rel="noopener noreferrer nofollow" target="_blank">
                          {s.title}
                        </a>
                      </span>
                    ))}
                  </p>
                )}
                {history.length > 1 && (
                  <p className="small muted">
                    {t.question.history}:{" "}
                    {history.map((h) => `${formatDate(h.createdAt, locale)} ${pct(h.probability)}`).join("  /  ")}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </article>
  );
}
