import type { CSSProperties } from "react";

/**
 * Two strands of dots, teal for yes and coral for no, twisting around each
 * other along the bottom of a dark band. Decorative only.
 */
export function Helix({ columns = 40 }: { columns?: number }) {
  return (
    <div className="helix" aria-hidden="true">
      {Array.from({ length: columns }, (_, i) => (
        <i key={i} style={{ "--i": i } as CSSProperties}>
          <b style={{ "--rung": i % 2 ? "var(--violet)" : "var(--amber)" } as CSSProperties} />
        </i>
      ))}
    </div>
  );
}
