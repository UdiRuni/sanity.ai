import type { Metadata } from "next";
import Link from "next/link";
import { QuestionRow } from "@/components/QuestionRow";
import type { QuestionStatus } from "@/db/schema";
import { localeFrom } from "@/i18n";
import { listQuestions } from "@/lib/data";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
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
  const requested = (await searchParams).status ?? "open";
  const active = requested in filters ? requested : "open";
  const views = await listQuestions(locale, filters[active]);
  if (active === "resolved") {
    views.sort(
      (a, b) => (b.question.resolvedAt?.getTime() ?? 0) - (a.question.resolvedAt?.getTime() ?? 0),
    );
  }

  const labels: Record<string, string> = {
    open: t.questions.filterOpen,
    locked: t.questions.filterLocked,
    resolved: t.questions.filterResolved,
  };

  return (
    <>
      <h1>{t.questions.title}</h1>
      <nav className="tabs" aria-label={t.questions.title}>
        {Object.keys(filters).map((key) => (
          <Link
            key={key}
            className="tab"
            href={`/${locale}/questions?status=${key}`}
            aria-current={key === active ? "page" : undefined}
          >
            {labels[key]}
          </Link>
        ))}
      </nav>
      {views.length === 0 ? (
        <p className="muted">
          {t.questions.empty}{" "}
          <Link className="link" href={`/${locale}/suggest`}>
            {t.nav.suggest}
          </Link>
        </p>
      ) : (
        <div className="q-list">
          {views.map((v) => (
            <QuestionRow key={v.question.id} view={v} t={t} locale={locale} />
          ))}
        </div>
      )}
    </>
  );
}
