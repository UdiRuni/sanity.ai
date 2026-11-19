import type { Metadata } from "next";
import Link from "next/link";
import { AskIcon, DecideIcon, ForecastIcon } from "@/components/Icons";
import { localeFrom } from "@/i18n";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { t } = localeFrom((await params).locale);
  return { title: t.about.title };
}

export default async function AboutPage({ params }: Props) {
  const { locale, t } = localeFrom((await params).locale);
  const icons = [<AskIcon key="a" />, <ForecastIcon key="f" />, <DecideIcon key="d" />];

  return (
    <>
      <h1>{t.about.title}</h1>
      <ol className="steps" style={{ listStyle: "none", padding: 0, marginTop: "1.75rem" }}>
        {t.ui.steps.map((s, i) => (
          <li className="step" key={s.h}>
            <div className="step-icon">{icons[i]}</div>
            <h3>
              {i + 1}. {s.h}
            </h3>
            <p>{s.p}</p>
          </li>
        ))}
      </ol>
      <div style={{ maxWidth: "46rem" }}>
        {t.about.sections.map((s) => (
          <section key={s.h} style={{ marginTop: "2.25rem" }}>
            <h2>{s.h}</h2>
            <p style={{ marginTop: "0.6rem", color: "var(--ink-2)" }}>{s.p}</p>
          </section>
        ))}
        <section style={{ marginTop: "2.25rem" }}>
          <h2>{t.ui.marketFull}</h2>
          <p style={{ marginTop: "0.6rem", color: "var(--ink-2)" }}>{t.ui.marketHint}</p>
        </section>
        <section style={{ marginTop: "2.25rem" }} id="sanity">
          <h2>{t.sanity.about.h}</h2>
          {t.sanity.about.ps.map((p) => (
            <p key={p} style={{ marginTop: "0.6rem", color: "var(--ink-2)" }}>
              {p}
            </p>
          ))}
          <ul className="check-defs" style={{ marginTop: "0.9rem", color: "var(--ink-2)" }}>
            {(["negation", "deadline", "language", "sycophancy"] as const).map((c) => (
              <li key={c}>
                <strong style={{ color: "var(--ink)" }}>{t.sanity.checks[c]}</strong>: {t.sanity.checkHints[c]}
              </li>
            ))}
          </ul>
          <p style={{ marginTop: "0.9rem" }}>
            <Link className="link" href={`/${locale}/leaderboard?track=sanity`}>
              {t.sanity.seeBoard}
            </Link>
          </p>
        </section>
      </div>
      <section className="section">
        <div className="cta-band">
          <div>
            <h2>{t.ui.ctaTitle}</h2>
            <p>{t.ui.ctaBody}</p>
          </div>
          <Link className="btn big" href={`/${locale}/suggest`}>
            {t.home.heroCta}
          </Link>
        </div>
      </section>
    </>
  );
}
