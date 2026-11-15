import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { formatDate, localeFrom } from "@/i18n";
import { pick } from "@/lib/data";
import { categories } from "@/lib/site";
import { DAY_MS, now } from "@/lib/time";
import { suggestQuestion, voteForQuestion } from "../actions";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { t } = localeFrom((await params).locale);
  return { title: t.suggest.title };
}

export default async function SuggestPage({ params, searchParams }: Props) {
  const { locale, t } = localeFrom((await params).locale);
  const { ok, error } = await searchParams;
  const db = await getDb();
  const pending = await db
    .select()
    .from(schema.questions)
    .where(eq(schema.questions.status, "pending"))
    .orderBy(desc(schema.questions.votes), desc(schema.questions.createdAt))
    .limit(30);

  const errorText = error ? t.suggest.errors[error as keyof typeof t.suggest.errors] : null;
  const minDate = new Date(now().getTime() + 4 * DAY_MS).toISOString().slice(0, 10);

  return (
    <div style={{ display: "grid", gap: "3rem", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))" }}>
      <section>
        <h1>{t.suggest.title}</h1>
        <p className="lead" style={{ marginBlock: "0.8rem 1.75rem" }}>
          {t.suggest.lead}
        </p>
        {ok && (
          <p className="notice" role="status">
            {t.suggest.thanks}
          </p>
        )}
        {errorText && (
          <p className="notice error" role="alert">
            {errorText}
          </p>
        )}
        <form action={suggestQuestion}>
          <input type="hidden" name="locale" value={locale} />
          <div className="field">
            <label htmlFor="title">{t.suggest.question}</label>
            <input id="title" name="title" required minLength={15} maxLength={200} />
            <span className="hint">{t.suggest.questionHint}</span>
          </div>
          <div className="field">
            <label htmlFor="criteria">{t.suggest.criteria}</label>
            <textarea id="criteria" name="criteria" required minLength={20} maxLength={600} />
            <span className="hint">{t.suggest.criteriaHint}</span>
          </div>
          <div style={{ display: "grid", gap: "0 1rem", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
            <div className="field">
              <label htmlFor="resolveBy">{t.suggest.resolveBy}</label>
              <input id="resolveBy" name="resolveBy" type="date" required min={minDate} />
            </div>
            <div className="field">
              <label htmlFor="category">{t.suggest.category}</label>
              <select id="category" name="category" defaultValue="world">
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {t.category[c]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="sourceUrl">{t.suggest.sourceUrl}</label>
            <input id="sourceUrl" name="sourceUrl" type="url" dir="ltr" placeholder="https://" />
          </div>
          <div className="field">
            <label htmlFor="name">{t.suggest.name}</label>
            <input id="name" name="name" maxLength={40} autoComplete="nickname" />
          </div>
          <button className="btn" type="submit">
            {t.suggest.submit}
          </button>
        </form>
      </section>

      <section>
        <h2>{t.suggest.queueTitle}</h2>
        <p className="muted" style={{ marginBlock: "0.5rem 1rem" }}>
          {t.suggest.queueLead}
        </p>
        {pending.length === 0 ? (
          <p className="muted">{t.suggest.queueEmpty}</p>
        ) : (
          <div style={{ borderTop: "1px solid var(--line)" }}>
            {pending.map((q) => (
              <div
                key={q.id}
                style={{
                  display: "flex",
                  gap: "1rem",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.9rem 0",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{pick(q.title, locale, q.lang)}</div>
                  <div className="meta" style={{ marginTop: "0.25rem" }}>
                    <span>{t.category[q.category as keyof typeof t.category] ?? q.category}</span>
                    <span>
                      {t.questions.resolves} {formatDate(q.resolveBy, locale)}
                    </span>
                    {q.suggestedBy && (
                      <span>
                        {t.questions.suggestedBy} {q.suggestedBy}
                      </span>
                    )}
                  </div>
                </div>
                <form action={voteForQuestion} style={{ textAlign: "center", flex: "none" }}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="questionId" value={q.id} />
                  <button className="btn quiet small" type="submit" aria-label={`${t.suggest.vote}: ${pick(q.title, locale, q.lang)}`}>
                    {t.suggest.vote}
                  </button>
                  <div className="small muted" style={{ marginTop: "0.2rem" }}>
                    {q.votes} {t.suggest.votes}
                  </div>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
