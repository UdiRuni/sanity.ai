import type { Metadata } from "next";
import Link from "next/link";
import { monthlyBudget, spentThisMonth } from "@/engine/run";
import { hasKey, providerKeyEnv, type ProviderId } from "@/engine/registry";
import { fill, formatDate, localeFrom } from "@/i18n";
import { adminEnabled, isAdmin } from "@/lib/admin";
import { getAdminData, pick } from "@/lib/data";
import { now } from "@/lib/time";
import {
  adminLogin,
  adminLogout,
  approveQuestion,
  rejectQuestion,
  resolveQuestion,
  runRoundNow,
} from "../actions";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

export default async function AdminPage({ params, searchParams }: Props) {
  const { locale, t } = localeFrom((await params).locale);
  const sp = await searchParams;

  if (!adminEnabled()) {
    return (
      <>
        <h1>{t.admin.title}</h1>
        <p className="notice error" style={{ marginTop: "1.25rem" }}>
          {t.admin.disabled}
        </p>
      </>
    );
  }

  if (!(await isAdmin())) {
    return (
      <div style={{ maxWidth: "24rem" }}>
        <h1>{t.admin.title}</h1>
        {sp.error && (
          <p className="notice error" role="alert" style={{ marginTop: "1.25rem" }}>
            {t.admin.wrong}
          </p>
        )}
        <form action={adminLogin} style={{ marginTop: "1.5rem" }}>
          <input type="hidden" name="locale" value={locale} />
          <div className="field">
            <label htmlFor="password">{t.admin.password}</label>
            <input id="password" name="password" type="password" required autoComplete="current-password" />
          </div>
          <button className="btn" type="submit">
            {t.admin.login}
          </button>
        </form>
      </div>
    );
  }

  const [{ pending, awaiting }, spent] = await Promise.all([getAdminData(), spentThisMonth()]);
  const budget = monthlyBudget();
  const nowMs = now().getTime();
  const due = awaiting.filter((q) => q.resolveBy.getTime() <= nowMs || q.status === "locked");
  const later = awaiting.filter((q) => !due.includes(q));

  return (
    <>
      <div className="section-head">
        <h1>{t.admin.title}</h1>
        <form action={adminLogout}>
          <input type="hidden" name="locale" value={locale} />
          <button className="btn quiet small" type="submit">
            {t.admin.logout}
          </button>
        </form>
      </div>

      {sp.written !== undefined && (
        <p className="notice" role="status">
          {fill(t.admin.report, {
            written: sp.written ?? "0",
            skipped: sp.skipped ?? "0",
            failed: sp.failed ?? "0",
            cost: `$${sp.cost ?? "0"}`,
          })}
        </p>
      )}

      <div className="panel wash" style={{ display: "flex", gap: "2.5rem", flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <div className="figure">
            ${spent.toFixed(2)} <span className="muted" style={{ fontSize: "1rem" }}>/ ${budget}</span>
          </div>
          <div className="figure-label">
            {t.admin.spent}, {t.admin.budget}
          </div>
        </div>
        <form action={runRoundNow}>
          <input type="hidden" name="locale" value={locale} />
          <button className="btn" type="submit">
            {t.admin.run}
          </button>
        </form>
        <div className="small">
          <strong>{t.admin.keys}</strong>
          {(Object.keys(providerKeyEnv) as ProviderId[]).map((p) => (
            <div key={p}>
              <span dir="ltr">{providerKeyEnv[p]}</span>: {hasKey(p) ? t.admin.keySet : t.admin.keyMissing}
            </div>
          ))}
        </div>
      </div>

      <section className="section">
        <h2>
          {t.admin.queue} ({pending.length})
        </h2>
        {pending.length === 0 && (
          <p className="muted" style={{ marginTop: "0.75rem" }}>
            {t.admin.nothing}
          </p>
        )}
        {pending.map((q) => (
          <div key={q.id} className="panel" style={{ marginTop: "1rem" }}>
            <div className="meta">
              <span>{t.category[q.category as keyof typeof t.category] ?? q.category}</span>
              <span>
                {t.questions.resolves} {formatDate(q.resolveBy, locale)}
              </span>
              <span>
                {q.votes} {t.suggest.votes}
              </span>
              {q.suggestedBy && <span>{q.suggestedBy}</span>}
              {q.sourceUrl && (
                <a className="link" href={q.sourceUrl} target="_blank" rel="noopener noreferrer nofollow">
                  {t.question.source}
                </a>
              )}
            </div>
            <form action={approveQuestion} style={{ marginTop: "0.8rem" }}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="id" value={q.id} />
              <div className="field">
                <label htmlFor={`title-${q.id}`}>{t.suggest.question}</label>
                <input id={`title-${q.id}`} name="title" defaultValue={pick(q.title, q.lang)} dir="auto" />
              </div>
              <div className="field">
                <label htmlFor={`criteria-${q.id}`}>{t.suggest.criteria}</label>
                <textarea id={`criteria-${q.id}`} name="criteria" defaultValue={pick(q.criteria, q.lang)} dir="auto" />
              </div>
              <div className="field" style={{ maxWidth: "14rem" }}>
                <label htmlFor={`edition-${q.id}`}>{t.admin.edition}</label>
                <select id={`edition-${q.id}`} name="edition" defaultValue={q.edition}>
                  <option value={q.edition}>{q.edition}</option>
                  {q.edition !== "global" && <option value="global">global</option>}
                </select>
              </div>
              <button className="btn small" type="submit">
                {t.admin.approve}
              </button>
            </form>
            <form action={rejectQuestion} style={{ marginTop: "0.8rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="id" value={q.id} />
              <input
                name="reason"
                aria-label={t.admin.rejectReason}
                placeholder={t.admin.rejectReason}
                style={{ flex: "1 1 220px", font: "inherit", padding: "0.35rem 0.6rem", border: "1px solid var(--line-strong)", borderRadius: 8 }}
              />
              <button className="btn quiet small" type="submit">
                {t.admin.reject}
              </button>
            </form>
          </div>
        ))}
      </section>

      <section className="section">
        <h2>
          {t.admin.awaiting} ({awaiting.length})
        </h2>
        <div className="table-wrap" style={{ marginTop: "0.75rem" }}>
          <table className="data">
            <tbody>
              {[...due, ...later].map((q) => (
                <tr key={q.id}>
                  <td>
                    <Link className="link" href={`/${locale}/questions/${q.slug}`}>
                      {pick(q.title, locale, q.lang)}
                    </Link>
                    <div className="meta" style={{ marginTop: "0.2rem" }}>
                      <span className={`chip ${q.status === "open" ? "open" : ""}`}>{t.status[q.status]}</span>
                      <span>
                        {t.questions.resolves} {formatDate(q.resolveBy, locale)}
                      </span>
                    </div>
                  </td>
                  <td>
                    <form action={resolveQuestion} style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="id" value={q.id} />
                      <input
                        name="resolutionUrl"
                        type="url"
                        dir="ltr"
                        aria-label={t.admin.proofUrl}
                        placeholder={t.admin.proofUrl}
                        style={{ flex: "1 1 180px", font: "inherit", fontSize: "0.86rem", padding: "0.3rem 0.5rem", border: "1px solid var(--line-strong)", borderRadius: 8 }}
                      />
                      <button className="btn small yes" name="verdict" value="yes" type="submit">
                        {t.admin.resolveYes}
                      </button>
                      <button className="btn small no" name="verdict" value="no" type="submit">
                        {t.admin.resolveNo}
                      </button>
                      <button className="btn small quiet" name="verdict" value="annul" type="submit">
                        {t.admin.annul}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
