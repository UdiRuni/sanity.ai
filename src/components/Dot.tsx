import type { CSSProperties } from "react";

/** A model's identity color, shown next to its name. Decorative: the name carries the meaning. */
export function Dot({ color }: { color: string }) {
  return <span className="dot" aria-hidden="true" style={{ "--dot": color } as CSSProperties} />;
}
