import Link from "next/link";
import type { Question } from "@/db/schema";
import { formatDate, pct, type Dictionary } from "@/i18n";
import { pick, type QuestionView } from "@/lib/data";
import type { Locale } from "@/lib/site";
import { Rail } from "./Rail";

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
      <span>{t.category[question.category as keyof Dictionary["category"]] ?? question.category}</span>
      {question.edition === "global" && locale !== "en" && <span>{t.questions.global}</span>}
      <span>
        {t.questions.resolves} {formatDate(question.resolveBy, locale)}
      </span>
      {question.suggestedBy && (
        <span>
          {t.questions.suggestedBy} {question.suggestedBy}
        </span>
      )}
      {question.slug.startsWith("demo-") && <span className="chip demo">{t.questions.demo}</span>}
    </div>
  );
}

export function QuestionRow({ view, t, locale }: { view: QuestionView; t: Dictionary; locale: Locale }) {
  const q = view.question;
  return (
    <article className="q-row">
      <div className="stack">
        <h3>
          <Link href={`/${locale}/questions/${q.slug}`}>{pick(q.title, locale, q.lang)}</Link>
        </h3>
        <QuestionMeta question={q} t={t} locale={locale} />
      </div>
      <div className="q-side">
        <div>
          <div className="figure">{view.median === null ? "?" : pct(view.median)}</div>
          <div className="figure-label">{t.rail.median}</div>
        </div>
        <Rail
          t={t}
          items={view.latest.map((l) => ({
            id: l.model.id,
            name: l.model.name,
            color: l.model.color,
            p: l.forecast.probability,
          }))}
          outcome={q.status === "resolved" ? q.outcome : null}
        />
      </div>
    </article>
  );
}
