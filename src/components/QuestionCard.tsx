import Link from "next/link";
import type { Question } from "@/db/schema";
import { fill, formatDate, pct, type Dictionary } from "@/i18n";
import { closestModel, pick, type QuestionView } from "@/lib/data";
import type { Locale } from "@/lib/site";
import { Bar } from "./Bar";

export function StatusChip({ question, t }: { question: Question; t: Dictionary }) {
  if (question.status === "resolved" && question.outcome !== null) {
    return (
      <span className={`chip ${question.outcome ? "yes" : "no"}`}>
        {/* The mark carries the meaning too, so it is not color alone. */}
        <span aria-hidden="true">{question.outcome ? "✓" : "✕"}</span>
        {question.outcome ? t.outcome.yes : t.outcome.no}
      </span>
    );
  }
  return <span className={`chip ${question.status === "open" ? "open" : ""}`}>{t.status[question.status]}</span>;
}

export function QuestionMeta({ question, t, locale }: { question: Question; t: Dictionary; locale: Locale }) {
  return (
    <div className="meta">
      <StatusChip question={question} t={t} />
      <span className="chip">{t.category[question.category as keyof Dictionary["category"]] ?? question.category}</span>
      {question.slug.startsWith("demo-") && <span className="chip demo">{t.questions.demo}</span>}
      <span>
        {t.questions.resolves} {formatDate(question.resolveBy, locale)}
      </span>
    </div>
  );
}

/** One sentence on how much the models disagree. */
export function spreadText(view: QuestionView, t: Dictionary): string | null {
  const ps = view.latest.map((l) => l.forecast.probability);
  if (ps.length < 2) return null;
  const low = Math.min(...ps);
  const high = Math.max(...ps);
  if (high - low < 0.08) return t.ui.agree;
  return fill(t.ui.between, { low: pct(low), high: pct(high) });
}

export function QuestionCard({
  view,
  t,
  locale,
  feature = false,
}: {
  view: QuestionView;
  t: Dictionary;
  locale: Locale;
  feature?: boolean;
}) {
  const q = view.question;
  const resolved = q.status === "resolved" && q.outcome !== null;
  const closest = resolved ? closestModel(view) : null;
  const TitleTag = feature ? "h2" : "h3";

  return (
    <article className={`card ${feature ? "feature" : ""}`}>
      <QuestionMeta question={q} t={t} locale={locale} />
      <TitleTag className="card-title" style={feature ? { fontSize: "1.5rem" } : undefined}>
        <Link className="card-link" href={`/${locale}/questions/${q.slug}`}>
          {pick(q.title, locale, q.lang)}
        </Link>
      </TitleTag>

      {view.median === null ? (
        <p className="muted">{t.rail.noForecasts}</p>
      ) : (
        <div>
          <div className="card-figure">
            <span className={`figure ${feature ? "big" : ""}`}>{pct(view.median)}</span>
            <span className="figure-label">
              {t.ui.chance}, {t.ui.think}
            </span>
          </div>
          <div style={{ marginTop: "0.7rem" }}>
            <Bar value={view.median} thick={feature} scale={feature} />
          </div>
          <p className="small muted" style={{ marginTop: "0.6rem" }}>
            {closest
              ? `${t.ui.closest} ${closest.model.name} (${pct(closest.forecast.probability)})`
              : spreadText(view, t)}
            {view.market && !resolved && (
              <>
                {" "}
                <span style={{ whiteSpace: "nowrap" }}>
                  {t.ui.market}: <strong style={{ color: "var(--ink)" }}>{pct(view.market.probability)}</strong>
                </span>
              </>
            )}
          </p>
        </div>
      )}

      <span className="card-foot" aria-hidden="true">
        {t.ui.seeWhy}
      </span>
    </article>
  );
}
