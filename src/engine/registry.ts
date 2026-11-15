/**
 * The model lineup. This file is the single place to add, retire or reprice a model.
 *
 * IMPORTANT before going live:
 * - `apiModel` strings for OpenAI, Google, xAI and OpenRouter were taken from
 *   pricing roundups in November 2026 and have NOT been verified against a live
 *   API. Check each provider's model list and fix them here.
 * - Prices are USD per million tokens and change every few months.
 * - A new model version is a new entry with a new `id`. Never repoint an
 *   existing id at a different model: its track record would be mixed.
 */

export type ProviderId = "anthropic" | "openai" | "google" | "xai" | "openrouter";

export type ModelSpec = {
  id: string;
  name: string;
  provider: ProviderId;
  apiModel: string;
  tier: "flagship" | "light" | "open";
  /** Identity color. Fixed order from a validated categorical palette. */
  color: string;
  supportsOpenBook: boolean;
  priceInPerMTok: number;
  priceOutPerMTok: number;
  /** Price of the provider's own web search tool per 1,000 calls. */
  searchPricePer1k: number;
};

export const modelRegistry: ModelSpec[] = [
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

export const providerKeyEnv: Record<ProviderId, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GEMINI_API_KEY",
  xai: "XAI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
};

export function hasKey(provider: ProviderId): boolean {
  return Boolean(process.env[providerKeyEnv[provider]]);
}
