import Link from "next/link";
import { site } from "@/lib/site";

/**
 * The mark is the site's core idea in one shape: a probability rail with a
 * forecast sitting on it, right of the halfway tick.
 */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="8" fill="#2343d8" />
      <path d="M6 16h20" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <path d="M13 10.5v11" stroke="#fff" strokeOpacity=".5" strokeWidth="2" strokeLinecap="round" />
      <circle cx="20.5" cy="16" r="5.6" fill="#fff" />
      <circle cx="20.5" cy="16" r="2.4" fill="#2343d8" />
    </svg>
  );
}

export function Logo({ href }: { href: string }) {
  return (
    <Link href={href} className="logo" aria-label={site.name}>
      <LogoMark />
      <span className="logo-word" dir="ltr">
        {site.name.toLowerCase()}
      </span>
    </Link>
  );
}
