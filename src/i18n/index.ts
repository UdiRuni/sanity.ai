import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/site";
import en from "./en";
import he, { type Dictionary } from "./he";

const dictionaries: Record<Locale, Dictionary> = { he, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

/** Validates the [locale] route param and returns it with its dictionary. */
export function localeFrom(param: string): { locale: Locale; t: Dictionary } {
  if (!isLocale(param)) notFound();
  return { locale: param, t: dictionaries[param] };
}

export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? ""));
}

export function formatDate(date: Date | null | undefined, locale: Locale): string {
  if (!date) return "";
  return new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function pct(p: number): string {
  return `${Math.round(p * 100)}%`;
}

export type { Dictionary };
