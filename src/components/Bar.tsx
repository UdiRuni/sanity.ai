import type { CSSProperties } from "react";

/**
 * The one way a probability is drawn on this site: a filled bar from 0 to 100.
 * The number is always shown next to it as text, so the bar never has to be
 * read on its own. Bars grow from zero when the page loads; `index` staggers
 * a list of them, and `color` paints one in a model's identity color.
 */
export function Bar({
  value,
  tone = "brand",
  thick = false,
  scale = false,
  label,
  color,
  index = 0,
}: {
  value: number; // 0 to 1
  tone?: "brand" | "market" | "yes" | "no" | "violet";
  thick?: boolean;
  scale?: boolean;
  label?: string;
  color?: string;
  index?: number;
}) {
  const pctValue = Math.round(Math.min(1, Math.max(0, value)) * 100);
  const style = { width: `${pctValue}%`, "--i": index, ...(color ? { "--fill": color } : {}) } as CSSProperties;
  return (
    <div>
      <div
        className={`bar ${tone === "brand" ? "" : tone} ${thick ? "thick" : ""}`}
        role="img"
        aria-label={label ?? `${pctValue}%`}
      >
        <span style={style} />
      </div>
      {scale && (
        <div className="bar-scale" aria-hidden="true">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      )}
    </div>
  );
}
