/**
 * Topic colors. Each tone is a CSS class (tone-coral, ...) that sets a solid
 * color, a pastel tint and a dark ink for text on the tint; see globals.css.
 * The topic name is always shown as text too, so color is never the only cue.
 */
export type Tone = "brand" | "teal" | "coral" | "amber" | "violet" | "rose" | "leaf";

const categoryTone: Record<string, Tone> = {
  politics: "coral",
  economy: "teal",
  tech: "violet",
  sports: "amber",
  culture: "rose",
  science: "brand",
  world: "leaf",
};

export function toneOf(category: string): Tone {
  return categoryTone[category] ?? "brand";
}

export function toneClass(category: string): string {
  return `tone-${toneOf(category)}`;
}
