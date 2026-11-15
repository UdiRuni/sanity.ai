/**
 * sanity.config.ts
 *
 * The one file that describes how the site connects to model providers:
 * which providers exist, where their APIs live, which models take part, what
 * they cost, and the limits every forecast runs under.
 *
 * Secrets are NOT stored here. Each provider names the environment variable
 * that holds its API key; put the keys in .env.local (see SETUP.md).
 *
 * After editing this file, run `npm run check:models` to test every connection.
 */

/** How a provider's API is spoken. Add a provider by picking one of these. */
export type ApiStyle =
  | "anthropic-messages" // POST {baseUrl}/messages
  | "responses" // POST {baseUrl}/responses (OpenAI and compatible)
  | "gemini" // POST {baseUrl}/models/{model}:generateContent
  | "chat-completions"; // POST {baseUrl}/chat/completions (no web search)

export type ProviderConfig = {
  label: string;
  /** Name of the environment variable that holds the API key. */
  keyEnv: string;
  baseUrl: string;
  api: ApiStyle;
  /** Value of the provider's version header, where it has one. */
  apiVersion?: string;
  /** The provider's own web search tool, used in the open-book track. Null = none. */
  searchTool: string | null;
  /** Where to create an API key. Shown in the setup guide and the checker. */
  keysUrl: string;
};

export const providers = {
  anthropic: {
    label: "Anthropic",
    keyEnv: "ANTHROPIC_API_KEY",
    baseUrl: "https://api.anthropic.com/v1",
    api: "anthropic-messages",
    apiVersion: "2023-06-01",
    searchTool: "web_search_20250305",
    keysUrl: "https://platform.claude.com/settings/keys",
  },
  openai: {
    label: "OpenAI",
    keyEnv: "OPENAI_API_KEY",
    baseUrl: "https://api.openai.com/v1",
    api: "responses",
    searchTool: "web_search",
    keysUrl: "https://platform.openai.com/api-keys",
  },
  google: {
    label: "Google",
    keyEnv: "GEMINI_API_KEY",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    api: "gemini",
    searchTool: "google_search",
    keysUrl: "https://aistudio.google.com/apikey",
  },
  xai: {
    label: "xAI",
    keyEnv: "XAI_API_KEY",
    baseUrl: "https://api.x.ai/v1",
    api: "responses",
    searchTool: "web_search",
    keysUrl: "https://console.x.ai",
  },
  openrouter: {
    label: "OpenRouter",
    keyEnv: "OPENROUTER_API_KEY",
    baseUrl: "https://openrouter.ai/api/v1",
    api: "chat-completions",
    searchTool: null,
    keysUrl: "https://openrouter.ai/keys",
  },
} satisfies Record<string, ProviderConfig>;

export type ProviderId = keyof typeof providers;

export type ModelConfig = {
  /** Stable id used in URLs and the database. Never reuse an id for a different model. */
  id: string;
  name: string;
  provider: ProviderId;
  /** The exact model id sent to the provider. */
  apiModel: string;
  tier: "flagship" | "light" | "open";
  /** Identity color on charts. Fixed for the model's lifetime. */
  color: string;
  /** Whether the model also runs in the open-book (web search) track. */
  supportsOpenBook: boolean;
  /** USD per million tokens. */
  priceInPerMTok: number;
  priceOutPerMTok: number;
  /** USD per 1,000 calls of the provider's search tool. */
  searchPricePer1k: number;
};

/**
 * The lineup.
 *
 * VERIFY BEFORE LAUNCH: the Anthropic ids follow the official docs. The
 * OpenAI, Google, xAI and OpenRouter `apiModel` values and every price came
 * from pricing roundups in November 2026 and have not been checked against a
 * live API. `npm run check:models` tells you which ids a provider rejects.
 *
 * A new model version is a new entry with a new `id`. Repointing an existing
 * id at another model would mix two track records.
 */
export const models: ModelConfig[] = [
  {
    id: "claude-opus-5-5",
    name: "Claude Opus 5.5",
    provider: "anthropic",
    apiModel: "claude-opus-5-5",
    tier: "flagship",
    color: "#eb6834",
    supportsOpenBook: true,
    priceInPerMTok: 4,
    priceOutPerMTok: 20,
    searchPricePer1k: 10,
  },
  {
    id: "gpt-sol",
    name: "GPT-5.6 Sol",
    provider: "openai",
    apiModel: "gpt-5.6-sol",
    tier: "flagship",
    color: "#1baf7a",
    supportsOpenBook: true,
    priceInPerMTok: 4,
    priceOutPerMTok: 20,
    searchPricePer1k: 10,
  },
  {
    id: "gemini-4",
    name: "Gemini 4 Argon",
    provider: "google",
    apiModel: "gemini-4-argon",
    tier: "flagship",
    color: "#2a78d6",
    supportsOpenBook: true,
    priceInPerMTok: 4,
    priceOutPerMTok: 20,
    searchPricePer1k: 14,
  },
  {
    id: "grok-4-7",
    name: "Grok 4.7",
    provider: "xai",
    apiModel: "grok-4.7",
    tier: "flagship",
    color: "#6250d6",
    supportsOpenBook: true,
    priceInPerMTok: 2,
    priceOutPerMTok: 6,
    searchPricePer1k: 5,
  },
  {
    id: "claude-haiku-5-5",
    name: "Claude Haiku 5.5",
    provider: "anthropic",
    apiModel: "claude-haiku-5-5",
    tier: "light",
    color: "#eda100",
    supportsOpenBook: false,
    priceInPerMTok: 0.1,
    priceOutPerMTok: 0.5,
    searchPricePer1k: 10,
  },
  {
    id: "gpt-luna",
    name: "GPT-5.6 Luna",
    provider: "openai",
    apiModel: "gpt-5.6-luna",
    tier: "light",
    color: "#008300",
    supportsOpenBook: false,
    priceInPerMTok: 0.2,
    priceOutPerMTok: 1.2,
    searchPricePer1k: 10,
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    provider: "openrouter",
    apiModel: "deepseek/deepseek-chat",
    tier: "open",
    color: "#e87ba4",
    supportsOpenBook: false,
    priceInPerMTok: 0.3,
    priceOutPerMTok: 1.2,
    searchPricePer1k: 0,
  },
  {
    id: "llama",
    name: "Llama",
    provider: "openrouter",
    apiModel: "meta-llama/llama-4-maverick",
    tier: "open",
    color: "#e34948",
    supportsOpenBook: false,
    priceInPerMTok: 0.2,
    priceOutPerMTok: 0.8,
    searchPricePer1k: 0,
  },
];

/** Limits that apply to every forecast, for every model. */
export const limits = {
  /** Most web searches one open-book forecast may run. */
  maxSearchesPerForecast: 5,
  maxOutputTokens: 4000,
  /** How long to wait for one model call before giving up. */
  timeoutMs: 180_000,
  /** Monthly spending cap in USD when MONTHLY_BUDGET_USD is not set. */
  defaultMonthlyBudgetUsd: 50,
  /** Most model calls in one scheduled run. */
  maxCallsPerRun: 200,
};

/**
 * Prediction markets used as a baseline. When a question has a market link,
 * the market's YES price is recorded on every scheduled run and scored on the
 * leaderboard as one more competitor: "can any model beat the market?"
 *
 * `api` is the public price endpoint; {id} is taken from the market's URL.
 * NOT VERIFIED: both endpoints are written from the markets' public API
 * documentation and have not been called from this code. If a fetch fails the
 * run carries on, and a price can always be typed in on the admin page.
 */
export const markets = {
  polymarket: {
    label: "Polymarket",
    host: "polymarket.com",
    api: "https://gamma-api.polymarket.com/markets?slug={id}",
  },
  kalshi: {
    label: "Kalshi",
    host: "kalshi.com",
    api: "https://api.elections.kalshi.com/trade-api/v2/markets/{id}",
  },
} as const;

export type MarketId = keyof typeof markets;

export const marketSettings = {
  /**
   * Whether question pages link out to the market. Off by default: these are
   * betting sites, and linking to them is a legal and brand decision.
   */
  showLink: false,
};
