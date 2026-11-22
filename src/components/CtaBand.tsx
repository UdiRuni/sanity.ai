import Link from "next/link";
import type { Dictionary } from "@/i18n";
import type { Locale } from "@/lib/site";
import { Helix } from "./Helix";

/** The closing invitation at the bottom of most pages. */
export function CtaBand({ t, locale }: { t: Dictionary; locale: Locale }) {
  return (
    <section className="section reveal">
      <div className="cta-band">
        <div>
          <h2>{t.ui.ctaTitle}</h2>
          <p>{t.ui.ctaBody}</p>
        </div>
        <Link className="btn big" href={`/${locale}/suggest`}>
          {t.home.heroCta}
        </Link>
        <Helix columns={34} />
      </div>
    </section>
  );
}
