import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { marketSettings } from "../../../../../sanity.config";
import { Arena } from "@/components/Arena";
import { Bar } from "@/components/Bar";
import { CtaBand } from "@/components/CtaBand";
import { Dot } from "@/components/Dot";
import { Num } from "@/components/Num";
import { QuestionMeta } from "@/components/QuestionCard";
import { SanitySection } from "@/components/Sanity";
import { marketLabel } from "@/engine/markets";
import { fill, formatDate, localeFrom, pct } from "@/i18n";
import { toneClass } from "@/lib/colors";
import { getQuestion, getQuestionSanity, latestPerModel, pick } from "@/lib/data";
import { brier, median } from "@/lib/scoring";
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
  const sanity = await getQuestionSanity(q, view.models);
  const track: Track = (await searchParams).track === "open" ? "open" : "closed";
  const latest = latestPerModel(view.forecasts, view.models, track).sort(
    (a, b) => b.forecast.probability - a.forecast.probability,
  );
  const ps = latest.map((l) => l.forecast.probability);
  const med = ps.length ? median(ps) : null;
  const resolved = q.status === "resolved" && q.outcome !== null;
  const market = view.market;

  return (
    <article style={{ maxWidth: "52rem", marginInline: "auto" }}>
      <QuestionMeta question={q} t={t} locale={locale} />
      <h1 style={{ marginTop: "0.9rem" }}>{pick(q.title, locale, q.lang)}</h1>

      {resolved && (
        <p className={`notice ${q.outcome ? "" : "error"}`} style={{ marginTop: "1.25rem", marginBottom: 0 }}>
          {q.outcome ? t.question.resolvedYes : t.question.resolvedNo}
          {q.resolutionUrl && (
            <>
              {" "}
              <a className="link" href={q.resolutionUrl} rel="noopener noreferrer nofollow" target="_blank">
                {t.question.proof}
              </a>
            </>
          )}
        </p>
      )}

      <section className={`card feature ${toneClass(q.category)}`} style={{ marginTop: "1.5rem" }}>
        <div className="card-figure">
          <span className="figure big">{med === null ? "?" : <Num value={med * 100} suffix="%" />}</span>
          <span className="figure-label">
            {t.ui.chance}, {t.ui.think}
          </span>
        </div>
        {latest.length >= 2 ? (
          <Arena latest={latest} t={t} />
        ) : (
          med !== null && <Bar value={med} thick scale color="var(--tone)" />
        )}
        {ps.length > 1 && (
          <p className="muted">
            {fill(t.ui.between, { low: pct(Math.min(...ps)), high: pct(Math.max(...ps)) })}
          </p>
        )}
      </section>

      <div className="panel soft" style={{ marginTop: "1.1rem" }}>
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
          {q.suggestedBy && (
            <span>
              {t.questions.suggestedBy} {q.suggestedBy}
            </span>
          )}
          {q.sourceUrl && (
            <a className="link" href={q.sourceUrl} rel="noopener noreferrer nofollow" target="_blank">
              {t.question.source}
            </a>
          )}
        </div>
      </div>

      <section className="section" style={{ marginTop: "2.75rem" }}>
        <div className="section-head">
          <h2>{t.question.forecasts}</h2>
          <nav className="pills" aria-label={t.question.forecasts}>
            {tracks.map((tr) => (
              <Link
                key={tr}
                className="pill"
                href={`/${locale}/questions/${q.slug}?track=${tr}`}
                aria-current={tr === track ? "page" : undefined}
              >
                {t.track[tr]}
              </Link>
            ))}
          </nav>
        </div>
        <p className="muted">
          {track === "closed" ? t.track.closedHint : t.track.openHint} {latest.length > 0 && t.ui.showWhy}
        </p>

        {latest.length === 0 ? (
          <p className="panel soft" style={{ marginTop: "1rem" }}>
            {t.rail.noForecasts}
          </p>
        ) : (
          <div className="rows cascade" style={{ marginTop: "1rem" }}>
            {latest.map(({ model, forecast }, i) => {
              const history = view.forecasts
                .filter((f) => f.modelId === model.id && f.track === track)
                .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
              return (
                <details className="row" key={model.id}>
                  <summary>
                    <span className="row-name">
                      <span className="caret" aria-hidden="true">
                        ▸
                      </span>
                      <Dot color={model.color} />
                      {model.name}
                    </span>
                    <Bar
                      value={forecast.probability}
                      label={`${model.name}: ${pct(forecast.probability)}`}
                      color={model.color}
                      index={i}
                    />
                    <span className="row-value">{pct(forecast.probability)}</span>
                  </summary>
                  <div className="row-body">
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
                    <p className="small" style={{ marginTop: "0.7rem" }}>
                      {resolved && (
                        <span className="muted">
                          {t.question.brier} {brier(forecast.probability, q.outcome!).toFixed(3)}.{" "}
                        </span>
                      )}
                      <Link className="link" href={`/${locale}/models/${model.id}`}>
                        {fill(t.ui.record, { name: model.name })}
                      </Link>
                    </p>
                  </div>
                </details>
              );
            })}

            {market && (
              <div className="row">
                <div className="row-static">
                  <span className="row-name">
                    {t.ui.market}
                    <span className="muted small" style={{ fontWeight: 400 }}>
                      {marketLabel(market.source)}
                    </span>
                  </span>
                  <Bar value={market.probability} tone="market" label={`${t.ui.marketFull}: ${pct(market.probability)}`} />
                  <span className="row-value">{pct(market.probability)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {market && (
          <p className="small muted" style={{ marginTop: "0.9rem" }}>
            {t.ui.marketHint}{" "}
            {marketSettings.showLink && q.marketUrl && (
              <a className="link" href={q.marketUrl} rel="noopener noreferrer nofollow" target="_blank">
                {marketLabel(market.source)}
              </a>
            )}
          </p>
        )}
      </section>

      {sanity && sanity.results.length > 0 && <SanitySection sanity={sanity} question={q} t={t} locale={locale} />}

      <CtaBand t={t} locale={locale} />
    </article>
  );
}
