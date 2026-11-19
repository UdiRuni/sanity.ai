import type { Metadata } from "next";
import Link from "next/link";
import { monthlyBudget, spentThisMonth } from "@/engine/run";
import { hasKey, providerKeyEnv, type ProviderId } from "@/engine/registry";
import { fill, formatDate, localeFrom } from "@/i18n";
import { adminEnabled, isAdmin } from "@/lib/admin";
import type { Question } from "@/db/schema";
import type { Dictionary } from "@/i18n";
import { getAdminData, pick } from "@/lib/data";
import { site } from "@/lib/site";
import { now } from "@/lib/time";
import {
  adminLogin,
  adminLogout,
  approveQuestion,
  recordMarketPrice,
  rejectQuestion,
  resolveQuestion,
  runRoundNow,
  runSanityNow,
  saveSanitySettings,
} from "../actions";

/** The site language a question can be translated into for the language check. */
function otherLang(q: Question): string {
  return site.locales.find((l) => l !== q.lang) ?? "en";
}

/**
 * The sanity test fields shared by the approval form and the settings form.
 * They sit inside the caller's <form>.
 */
function SanityFields({ q, t }: { q: Question; t: Dictionary }) {
  const other = otherLang(q);
  const lang = t.sanity.langNames[other] ?? other;
  return (
    <>
      <input type="hidden" name="otherLang" value={other} />
      <div className="field check-field">
        <label>
          <input type="checkbox" name="eventByDeadline" defaultChecked={q.eventByDeadline} />
          <span>{t.admin.eventByDeadline}</span>
        </label>
      </div>
      <details className="field">
        <summary className="small" style={{ cursor: "pointer", fontWeight: 600 }}>
          {fill(t.admin.translation, { lang })}
        </summary>
        <div style={{ marginTop: "0.6rem" }}>
          <div className="field">
            <label htmlFor={`title-${other}-${q.id}`}>{fill(t.admin.translationTitle, { lang })}</label>
            <input id={`title-${other}-${q.id}`} name="titleOther" defaultValue={q.title[other] ?? ""} dir="auto" lang={other} />
          </div>
          <div className="field">
            <label htmlFor={`criteria-${other}-${q.id}`}>{fill(t.admin.translationCriteria, { lang })}</label>
            <textarea
              id={`criteria-${other}-${q.id}`}
              name="criteriaOther"
              defaultValue={q.criteria[other] ?? ""}
              dir="auto"
              lang={other}
            />
          </div>
          <p className="hint small muted">{t.admin.translationHint}</p>
        </div>
      </details>
    </>
  );
}

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

// "Run a forecast round now" calls models from this page's server action.
export const maxDuration = 300;

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

  const [{ pending, awaiting, sanityAnswers }, spent] = await Promise.all([getAdminData(), spentThisMonth()]);
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
            sanity: sp.sanity ?? "0",
          })}
        </p>
      )}
      {sp.sanityWritten !== undefined && (
        <p className="notice" role="status">
          {fill(t.admin.sanityReport, {
            tests: sp.sanityTests ?? "0",
            written: sp.sanityWritten ?? "0",
            failed: sp.sanityFailed ?? "0",
            cost: `$${sp.sanityCost ?? "0"}`,
          })}
        </p>
      )}
      {sp.sanityError && (
        <p className="notice error" role="alert">
          {t.admin.sanityCannot}
        </p>
      )}

      <div className="panel soft" style={{ display: "flex", gap: "2.5rem", flexWrap: "wrap", alignItems: "center" }}>
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
              <div className="field">
                <label htmlFor={`market-${q.id}`}>{t.ui.marketUrl}</label>
                <input id={`market-${q.id}`} name="marketUrl" type="url" dir="ltr" placeholder="https://polymarket.com/event/..." />
              </div>
              <SanityFields q={q} t={t} />
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
                className="input"
                style={{ flex: "1 1 220px", width: "auto" }}
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
                    <details className="sanity-admin" style={{ marginTop: "0.6rem" }}>
                      <summary className="small" style={{ cursor: "pointer" }}>
                        <strong>{t.admin.sanity}</strong>:{" "}
                        {sanityAnswers.has(q.id)
                          ? fill(t.admin.sanityStarted, { n: sanityAnswers.get(q.id) ?? 0 })
                          : t.admin.sanityNone}
                      </summary>
                      <form action={saveSanitySettings} style={{ marginTop: "0.7rem" }}>
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="id" value={q.id} />
                        <SanityFields q={q} t={t} />
                        <button className="btn small quiet" type="submit">
                          {t.admin.sanitySave}
                        </button>
                      </form>
                      {q.status === "open" && (
                        <form action={runSanityNow} style={{ marginTop: "0.6rem" }}>
                          <input type="hidden" name="locale" value={locale} />
                          <input type="hidden" name="id" value={q.id} />
                          <button className="btn small" type="submit">
                            {t.admin.sanityRun}
                          </button>
                        </form>
                      )}
                    </details>
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
                        className="input"
                        style={{ flex: "1 1 180px", width: "auto", padding: "0.35rem 0.6rem", fontSize: "0.9rem" }}
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
                    {q.status === "open" && (
                      <form action={recordMarketPrice} style={{ display: "flex", gap: "0.4rem", justifyContent: "flex-end", marginTop: "0.5rem" }}>
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="id" value={q.id} />
                        <input
                          name="percent"
                          type="number"
                          min={1}
                          max={99}
                          dir="ltr"
                          aria-label={t.ui.marketPrice}
                          placeholder={t.ui.marketPrice}
                          className="input"
                          style={{ flex: "0 1 230px", width: "auto", padding: "0.35rem 0.6rem", fontSize: "0.9rem" }}
                        />
                        <button className="btn small quiet" type="submit">
                          {t.ui.save}
                        </button>
                      </form>
                    )}
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
