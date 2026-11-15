import type { Dictionary } from "@/i18n";
import { pct } from "@/i18n";

export type RailItem = { id: string; name: string; color: string; p: number };

/**
 * The probability rail: every model's forecast as a dot on a 0 to 100 line.
 * The spread of the dots is the disagreement, visible at a glance.
 *
 * Dots that would overlap are stacked upward. Hover or keyboard focus shows
 * the model's name and number; the full-size rail is always paired with a
 * legend, so identity never depends on color alone.
 */
export function Rail({
  items,
  t,
  size = "sm",
  median,
  outcome,
}: {
  items: RailItem[];
  t: Dictionary;
  size?: "sm" | "lg";
  median?: number | null;
  outcome?: boolean | null;
}) {
  if (items.length === 0) {
    return <p className="muted small">{t.rail.noForecasts}</p>;
  }

  const dot = size === "lg" ? 16 : 11;
  const minGap = size === "lg" ? 0.045 : 0.065; // how close two dots may sit in one row
  const rowStep = dot + 3;

  const sorted = [...items].sort((a, b) => a.p - b.p);
  const rowEnds: number[] = [];
  const placed = sorted.map((item) => {
    let row = rowEnds.findIndex((end) => item.p - end >= minGap);
    if (row === -1) {
      row = rowEnds.length;
      rowEnds.push(item.p);
    } else {
      rowEnds[row] = item.p;
    }
    return { ...item, row };
  });
  const rows = Math.max(1, rowEnds.length);
  const height = 14 + rows * rowStep;

  return (
    <div className="rail" style={{ ["--dot" as string]: `${dot}px`, ["--rail-h" as string]: `${height}px` }}>
      <div className="rail-track">
        <div className="rail-line" />
        {[0, 0.5, 1].map((x) => (
          <span key={x} className="rail-tick" style={{ left: `${x * 100}%` }} />
        ))}
        {typeof median === "number" && size === "lg" && (
          <span className="rail-median" style={{ left: `${median * 100}%` }} title={`${t.rail.median} ${pct(median)}`} />
        )}
        {typeof outcome === "boolean" && (
          <span
            className="rail-outcome"
            style={{ left: outcome ? "100%" : "0%", background: outcome ? "var(--yes)" : "var(--no)" }}
            title={outcome ? t.outcome.yes : t.outcome.no}
          />
        )}
        {placed.map((item) => (
          <span
            key={item.id}
            className="rail-dot"
            tabIndex={0}
            role="img"
            aria-label={`${item.name}: ${pct(item.p)}`}
            style={{
              left: `${item.p * 100}%`,
              bottom: `${1 + item.row * rowStep}px`,
              background: item.color,
            }}
          >
            <span className="rail-tip">
              {item.name} {pct(item.p)}
            </span>
          </span>
        ))}
      </div>
      <div className="rail-axis" aria-hidden="true">
        <span>{t.rail.no} 0%</span>
        <span>50%</span>
        <span>100% {t.rail.yes}</span>
      </div>
    </div>
  );
}
