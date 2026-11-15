import { limits, markets, type MarketId } from "../../sanity.config";

/**
 * Prediction-market prices, used as a baseline competitor.
 * Everything here is pure or a plain fetch, so it can be unit tested.
 */

export type MarketRef = { source: MarketId; id: string };

/** Finds which market a URL belongs to and the id its API expects. */
export function parseMarketUrl(raw: string): MarketRef | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "");
  const parts = url.pathname.split("/").filter(Boolean);
  const last = parts[parts.length - 1];
  if (!last) return null;

  for (const key of Object.keys(markets) as MarketId[]) {
    if (host !== markets[key].host) continue;
    // Polymarket: /event/<event>/<market-slug> or /market/<slug>. Kalshi: /markets/.../<TICKER>.
    return { source: key, id: key === "kalshi" ? last.toUpperCase() : last.toLowerCase() };
  }
  return null;
}

function clamp01(p: number): number | null {
  if (!Number.isFinite(p)) return null;
  const v = p > 1 ? p / 100 : p; // some APIs quote cents
  return v >= 0 && v <= 1 ? v : null;
}

/** Polymarket Gamma API: an array of markets with stringified outcome arrays. */
export function extractPolymarketPrice(data: unknown): number | null {
  const market = Array.isArray(data) ? data[0] : data;
  if (!market || typeof market !== "object") return null;
  const m = market as Record<string, unknown>;
  try {
    const outcomes = typeof m.outcomes === "string" ? JSON.parse(m.outcomes) : m.outcomes;
    const prices = typeof m.outcomePrices === "string" ? JSON.parse(m.outcomePrices) : m.outcomePrices;
    if (!Array.isArray(outcomes) || !Array.isArray(prices)) return null;
    const yes = outcomes.findIndex((o) => String(o).toLowerCase() === "yes");
    return clamp01(Number(prices[yes === -1 ? 0 : yes]));
  } catch {
    return null;
  }
}

/** Kalshi: { market: { yes_bid, yes_ask, last_price } }, quoted in cents or dollars. */
export function extractKalshiPrice(data: unknown): number | null {
  const m = (data as { market?: Record<string, unknown> } | null)?.market;
  if (!m) return null;
  const num = (k: string) => (m[k] === undefined || m[k] === null ? NaN : Number(m[k]));
  const bid = num("yes_bid_dollars") || num("yes_bid");
  const ask = num("yes_ask_dollars") || num("yes_ask");
  if (Number.isFinite(bid) && Number.isFinite(ask) && bid > 0 && ask > 0) {
    const b = clamp01(bid);
    const a = clamp01(ask);
    if (b !== null && a !== null) return (a + b) / 2;
  }
  return clamp01(num("last_price_dollars") || num("last_price"));
}

export async function fetchMarketPrice(ref: MarketRef): Promise<number> {
  const url = markets[ref.source].api.replace("{id}", encodeURIComponent(ref.id));
  const res = await fetch(url, { signal: AbortSignal.timeout(Math.min(limits.timeoutMs, 20_000)) });
  if (!res.ok) throw new Error(`${markets[ref.source].label} responded ${res.status}`);
  const data = await res.json();
  const price = ref.source === "polymarket" ? extractPolymarketPrice(data) : extractKalshiPrice(data);
  if (price === null) throw new Error(`${markets[ref.source].label}: no usable YES price in the response`);
  // A market never says exactly 0 or 1 while open; keep it inside the forecast range.
  return Math.min(0.99, Math.max(0.01, price));
}

export function marketLabel(source: string): string {
  return source in markets ? markets[source as MarketId].label : "Market";
}
