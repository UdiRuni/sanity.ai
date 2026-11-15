/**
 * Site-wide settings. The brand name lives here only, so a rename is a
 * one-line change.
 */
export const site = {
  name: "Sanity",
  domain: "sanity.ai",
  locales: ["he", "en"] as const,
  defaultLocale: "he" as const,
};

export type Locale = (typeof site.locales)[number];

export function isLocale(value: string): value is Locale {
  return (site.locales as readonly string[]).includes(value);
}

export function dirOf(locale: Locale): "rtl" | "ltr" {
  return locale === "he" ? "rtl" : "ltr";
}

/**
 * An edition is a country version of the site. Each locale reads one local
 * edition plus the shared global questions. Adding a country means adding a
 * locale here, a dictionary, and an editor for its local questions.
 */
export const editionOf: Record<Locale, string> = {
  he: "il",
  en: "global",
};

export function editionsVisibleTo(locale: Locale): string[] {
  const local = editionOf[locale];
  return local === "global" ? ["global"] : [local, "global"];
}

export const categories = [
  "politics",
  "economy",
  "tech",
  "sports",
  "culture",
  "science",
  "world",
] as const;

export type Category = (typeof categories)[number];

export const tracks = ["closed", "open"] as const;
export type Track = (typeof tracks)[number];
