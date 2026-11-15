import Link from "next/link";

// not-found receives no route params, so it shows both languages.
export default function NotFound() {
  return (
    <div style={{ paddingBlock: "3rem" }}>
      <svg width="120" height="40" viewBox="0 0 120 40" aria-hidden="true">
        <path d="M6 28h108" stroke="#c9d0dc" strokeWidth="2" strokeLinecap="round" />
        <path d="M60 22v12" stroke="#c9d0dc" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="60" cy="10" r="6" fill="none" stroke="#2343d8" strokeWidth="2" strokeDasharray="3 3" />
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
