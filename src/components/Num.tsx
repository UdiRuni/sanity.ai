import type { CSSProperties } from "react";

/**
 * A whole number that counts up from zero when the page loads, in CSS only.
 * Screen readers get the plain number; browsers without the CSS feature, and
 * readers who asked for less motion, see the final value at once.
 */
export function Num({ value, suffix = "" }: { value: number; suffix?: string }) {
  const n = Math.round(value);
  return (
    <>
      <span aria-hidden="true">
        <span className="count" style={{ "--to": n } as CSSProperties} />
        {suffix}
      </span>
      <span className="sr-only">
        {n}
        {suffix}
      </span>
    </>
  );
}
