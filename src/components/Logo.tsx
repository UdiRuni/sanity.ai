import Link from "next/link";
import { site } from "@/lib/site";

/** A check mark in a rounded square: a sanity check. */
export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="9" fill="#2f5bea" />
      <path d="M9 16.6l4.6 4.6L23 11.4" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
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
