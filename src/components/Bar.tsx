/**
 * The one way a probability is drawn on this site: a filled bar from 0 to 100.
 * The number is always shown next to it as text, so the bar never has to be
 * read on its own.
 */
export function Bar({
  value,
  tone = "brand",
  thick = false,
  scale = false,
  label,
}: {
  value: number; // 0 to 1
  tone?: "brand" | "market" | "yes" | "no";
  thick?: boolean;
  scale?: boolean;
  label?: string;
}) {
  const pctValue = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div>
      <div
        className={`bar ${tone === "brand" ? "" : tone} ${thick ? "thick" : ""}`}
        role="img"
        aria-label={label ?? `${pctValue}%`}
      >
        <span style={{ width: `${pctValue}%` }} />
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
