import Link from "next/link";

// not-found receives no route params, so it shows both languages.
export default function NotFound() {
  return (
    <div style={{ paddingBlock: "3rem" }}>
      <svg width="64" height="64" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="9" fill="#e8eeff" />
        <path d="M12.200 12.500a3.800 3.800 0 1 1 5.400 3.500c-1.100.5-1.600 1.200-1.600 2.400" fill="none" stroke="#2f5bea" strokeWidth="2.600" strokeLinecap="round" />
        <circle cx="16" cy="22.400" r="1.600" fill="#2f5bea" />
      </svg>
      <h1 style={{ marginTop: "1.25rem" }}>הדף לא נמצא</h1>
      <p className="lead" style={{ marginTop: "0.5rem" }} lang="en" dir="ltr">
        Page not found
      </p>
      <p style={{ marginTop: "1.5rem", display: "flex", gap: "0.7rem", flexWrap: "wrap" }}>
        <Link className="btn" href="/he">
          חזרה לדף הבית
        </Link>
        <Link className="btn quiet" href="/en">
          Back to the home page
        </Link>
      </p>
    </div>
  );
}
