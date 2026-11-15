/**
 * Typed access to sanity.config.ts. Nothing is configured here: to add,
 * retire or reprice a model, or to change how a provider is reached, edit
 * sanity.config.ts in the repository root.
 */
import {
  models,
  providers,
  type ModelConfig,
  type ProviderConfig,
  type ProviderId,
} from "../../sanity.config";

export type { ProviderId };
export type ModelSpec = ModelConfig;

export const modelRegistry: ModelSpec[] = models;

export function providerOf(id: ProviderId): ProviderConfig {
  return providers[id];
}

export const providerIds = Object.keys(providers) as ProviderId[];

/** Provider id to the name of the environment variable holding its key. */
export const providerKeyEnv = Object.fromEntries(
  providerIds.map((id) => [id, providers[id].keyEnv]),
) as Record<ProviderId, string>;

export function apiKey(provider: ProviderId): string | undefined {
  return process.env[providers[provider].keyEnv] || undefined;
}

export function hasKey(provider: ProviderId): boolean {
  return Boolean(apiKey(provider));
}
