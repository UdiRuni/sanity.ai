"use client";

import { useState, useSyncExternalStore } from "react";

const noSubscription = () => () => {};

/**
 * Share links that work without JavaScript, plus two that need it: the
 * phone's own share sheet (where the browser offers one) and copy to
 * clipboard. `url` is absolute, built on the server from the request.
 */
export function ShareButtons({
  url,
  text,
  labels,
}: {
  url: string;
  text: string;
  labels: { share: string; whatsapp: string; x: string; copy: string; copied: string };
}) {
  // False on the server and during hydration, the browser's answer after that.
  const canShare = useSyncExternalStore(
    noSubscription,
    () => typeof navigator.share === "function",
    () => false,
  );
  const [copied, setCopied] = useState(false);

  async function nativeShare() {
    try {
      await navigator.share({ text, url });
    } catch {
      // The reader closed the share sheet. Nothing to do.
    }
  }

  async function copy() {
    let ok = false;
    try {
      await navigator.clipboard.writeText(url);
      ok = true;
    } catch {
      // Older browsers, or a page without clipboard permission.
      const field = document.createElement("textarea");
      field.value = url;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      field.remove();
    }
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    }
  }

  const message = `${text} ${url}`;
  return (
    <div className="share-row" role="group" aria-label={labels.share}>
      {canShare && (
        <button type="button" className="btn small" onClick={nativeShare}>
          {labels.share}
        </button>
      )}
      <a className="btn small quiet" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
        {labels.whatsapp}
      </a>
      <a
        className="btn small quiet"
        href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        {labels.x}
      </a>
      <button type="button" className="btn small quiet" onClick={copy} aria-live="polite">
        {copied ? labels.copied : labels.copy}
      </button>
    </div>
  );
}
