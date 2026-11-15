import type { Metadata } from "next";
import Link from "next/link";
import { Rail } from "@/components/Rail";
import { localeFrom } from "@/i18n";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { t } = localeFrom((await params).locale);
  return { title: t.about.title };
}

export default async function AboutPage({ params }: Props) {
  const { locale, t } = localeFrom((await params).locale);
  // A fixed illustration of how to read the rail, not live data.
  const example = [
    { id: "a", name: "A", color: "#2a78d6", p: 0.31 },
    { id: "b", name: "B", color: "#eb6834", p: 0.58 },
    { id: "c", name: "C", color: "#1baf7a", p: 0.62 },
    { id: "d", name: "D", color: "#6250d6", p: 0.84 },
  ];

  return (
    <div style={{ maxWidth: "46rem" }}>
      <h1>{t.about.title}</h1>
      <div className="panel" style={{ marginTop: "1.75rem" }}>
        <Rail t={t} size="lg" items={example} median={0.6} />
      </div>
      {t.about.sections.map((s) => (
        <section key={s.h} style={{ marginTop: "2.25rem" }}>
          <h2>{s.h}</h2>
          <p style={{ marginTop: "0.6rem", color: "var(--ink-2)" }}>{s.p}</p>
        </section>
      ))}
      <p style={{ marginTop: "2.5rem" }}>
        <Link className="btn" href={`/${locale}/suggest`}>
          {t.home.heroCta}
        </Link>
      </p>
    </div>
  );
}
