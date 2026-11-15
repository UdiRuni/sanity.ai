import type { Metadata } from "next";
import Link from "next/link";
import { QuestionCard } from "@/components/QuestionCard";
import type { QuestionStatus } from "@/db/schema";
import { localeFrom } from "@/i18n";
import { listQuestions } from "@/lib/data";
import { categories } from "@/lib/site";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; topic?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { t } = localeFrom((await params).locale);
  return { title: t.questions.title };
}

const filters: Record<string, QuestionStatus[]> = {
  open: ["open"],
  locked: ["locked"],
  resolved: ["resolved"],
};

export default async function QuestionsPage({ params, searchParams }: Props) {
  const { locale, t } = localeFrom((await params).locale);
  const sp = await searchParams;
  const status = sp.status && sp.status in filters ? sp.status : "open";
  const topic = (categories as readonly string[]).includes(sp.topic ?? "") ? sp.topic! : null;

  let views = await listQuestions(locale, filters[status]);
  if (topic) views = views.filter((v) => v.question.category === topic);
  if (status === "resolved") {
    views.sort(
      (a, b) => (b.question.resolvedAt?.getTime() ?? 0) - (a.question.resolvedAt?.getTime() ?? 0),
    );
  }

  const labels: Record<string, string> = {
    open: t.questions.filterOpen,
    locked: t.questions.filterLocked,
    resolved: t.questions.filterResolved,
  };
  const href = (s: string, c: string | null) =>
    `/${locale}/questions?status=${s}${c ? `&topic=${c}` : ""}`;

  return (
    <>
      <h1>{t.questions.title}</h1>

      <nav className="pills" aria-label={t.questions.title} style={{ marginTop: "1.5rem" }}>
        {Object.keys(filters).map((key) => (
          <Link key={key} className="pill" href={href(key, topic)} aria-current={key === status ? "page" : undefined}>
            {labels[key]}
          </Link>
        ))}
      </nav>

      <p className="small muted" style={{ marginTop: "1.5rem", marginBottom: "0.5rem" }}>
        {t.ui.exploreTitle}
      </p>
      <nav className="pills" aria-label={t.ui.exploreTitle}>
        <Link className="pill" href={href(status, null)} aria-current={topic === null ? "page" : undefined}>
          {t.ui.all}
        </Link>
        {categories.map((c) => (
          <Link key={c} className="pill" href={href(status, c)} aria-current={c === topic ? "page" : undefined}>
            {t.category[c]}
          </Link>
        ))}
      </nav>

      {views.length === 0 ? (
        <div className="panel soft" style={{ marginTop: "2rem", textAlign: "center", padding: "2.5rem 1.5rem" }}>
          <p style={{ marginInline: "auto" }}>{topic ? t.ui.emptyCategory : t.questions.empty}</p>
          <p style={{ marginTop: "1rem", marginInline: "auto" }}>
            <Link className="btn" href={`/${locale}/suggest`}>
              {t.ui.beFirst}
            </Link>
          </p>
        </div>
      ) : (
        <div className="grid" style={{ marginTop: "2rem" }}>
          {views.map((v) => (
            <QuestionCard key={v.question.id} view={v} t={t} locale={locale} />
          ))}
        </div>
      )}
    </>
  );
}
