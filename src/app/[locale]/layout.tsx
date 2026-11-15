import type { Metadata } from "next";
import Link from "next/link";
import "@fontsource-variable/assistant";
import "@fontsource-variable/frank-ruhl-libre";
import "../globals.css";
import { Logo } from "@/components/Logo";
import { localeFrom } from "@/i18n";
import { hasMockData } from "@/lib/data";
import { dirOf, site } from "@/lib/site";

// Every page reads live data, so nothing is prerendered at build time.
export const dynamic = "force-dynamic";

type Props = { children: React.ReactNode; params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { locale: raw } = await params;
  const { t } = localeFrom(raw);
  return {
    title: { default: `${site.name}: ${t.tagline}`, template: `%s | ${site.name}` },
    description: t.home.heroBody,
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale: raw } = await params;
  const { locale, t } = localeFrom(raw);
  const other = locale === "he" ? "en" : "he";
  const demo = await hasMockData();

  return (
    <html lang={locale} dir={dirOf(locale)}>
      <body>
        {demo && (
          <div className="demo-banner" role="status">
            <div className="page">{t.demoBanner}</div>
          </div>
        )}
        <header className="site-header">
          <div className="page">
            <Logo href={`/${locale}`} />
            <nav className="site-nav" aria-label={site.name}>
              <Link href={`/${locale}/questions`}>{t.nav.questions}</Link>
              <Link href={`/${locale}/leaderboard`}>{t.nav.leaderboard}</Link>
              <Link href={`/${locale}/suggest`}>{t.nav.suggest}</Link>
              <Link href={`/${locale}/about`}>{t.nav.about}</Link>
              <Link href={`/${other}`} className="locale" lang={other}>
                {t.nav.otherLocale}
              </Link>
            </nav>
          </div>
        </header>
        <main>
          <div className="page">{children}</div>
        </main>
        <footer className="site-footer">
          <div className="page">
            <p>{t.footer.note}</p>
            <p>{t.footer.unaffiliated}</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
