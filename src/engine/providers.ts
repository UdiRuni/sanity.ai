import type { Track } from "@/lib/site";
import { limits, type ProviderConfig } from "../../sanity.config";
import { apiKey, providerOf, type ModelSpec } from "./registry";

/**
 * Talks to model providers. There is one function per API style, and every
 * URL, version, tool name and limit comes from sanity.config.ts, so pointing
 * the site at a different endpoint or tool version is a config change.
 *
 * STATUS: the "anthropic-messages" request shape was checked against the
 * official docs. The "responses", "gemini" and "chat-completions" shapes are
 * written from the providers' public API conventions and have NOT been run
 * with live keys. `npm run check:models` exercises each one.
 */

export type ProviderResult = {
  text: string;
  tokensIn: number;
  tokensOut: number;
  searches: number;
  sources: { title: string; url: string }[];
};

type Prompt = { system: string; user: string };

async function postJson(url: string, headers: Record<string, string>, body: unknown) {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(limits.timeoutMs),
    });
  } catch (err) {
    // Node reports network problems as a bare "fetch failed"; the cause has the reason.
    const cause = err instanceof Error && err.cause instanceof Error ? `: ${err.cause.message}` : "";
    throw new Error(`Could not reach ${new URL(url).host}${cause || `: ${String(err)}`}`);
  }
  const text = await res.text();
  if (!res.ok) throw new Error(`${url} responded ${res.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text);
}

function dedupe(sources: { title: string; url: string }[]) {
  const seen = new Set<string>();
  return sources.filter((s) => s.url && !seen.has(s.url) && seen.add(s.url)).slice(0, 8);
}

/** Search is on only in the open-book track and only if the provider has a tool. */
function searchToolFor(cfg: ProviderConfig, track: Track): string | null {
  return track === "open" ? cfg.searchTool : null;
}

/* ---------- anthropic-messages ---------- */

async function anthropicMessages(
  cfg: ProviderConfig,
  key: string,
  model: ModelSpec,
  prompt: Prompt,
  track: Track,
): Promise<ProviderResult> {
  const headers: Record<string, string> = { "x-api-key": key };
  if (cfg.apiVersion) headers["anthropic-version"] = cfg.apiVersion;
  const tool = searchToolFor(cfg, track);
  const tools = tool
    ? [{ type: tool, name: "web_search", max_uses: limits.maxSearchesPerForecast }]
    : undefined;

  type Block = {
    type: string;
    text?: string;
    content?: { type: string; title?: string; url?: string }[];
  };
  const messages: { role: string; content: unknown }[] = [{ role: "user", content: prompt.user }];
  let text = "";
  let tokensIn = 0;
  let tokensOut = 0;
  let searches = 0;
  const sources: { title: string; url: string }[] = [];

  // Long server-side tool turns can return stop_reason "pause_turn"; resend to continue.
  for (let turn = 0; turn < 3; turn++) {
    const data = await postJson(`${cfg.baseUrl}/messages`, headers, {
      model: model.apiModel,
      max_tokens: limits.maxOutputTokens,
      system: prompt.system,
      messages,
      ...(tools ? { tools } : {}),
    });
    tokensIn += data.usage?.input_tokens ?? 0;
    tokensOut += data.usage?.output_tokens ?? 0;
    searches += data.usage?.server_tool_use?.web_search_requests ?? 0;
    for (const block of (data.content ?? []) as Block[]) {
      if (block.type === "text" && block.text) text += block.text;
      if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
        for (const r of block.content) {
          if (r.type === "web_search_result" && r.url) {
            sources.push({ title: r.title ?? r.url, url: r.url });
          }
        }
      }
    }
    if (data.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: data.content });
  }
  return { text, tokensIn, tokensOut, searches, sources: dedupe(sources) };
}

/* ---------- responses (OpenAI, xAI and compatible) ---------- */

async function responsesApi(
  cfg: ProviderConfig,
  key: string,
  model: ModelSpec,
  prompt: Prompt,
  track: Track,
): Promise<ProviderResult> {
  const tool = searchToolFor(cfg, track);
  const data = await postJson(
    `${cfg.baseUrl}/responses`,
    { authorization: `Bearer ${key}` },
    {
      model: model.apiModel,
      instructions: prompt.system,
      input: prompt.user,
      max_output_tokens: limits.maxOutputTokens,
      ...(tool ? { tools: [{ type: tool }], max_tool_calls: limits.maxSearchesPerForecast } : {}),
    },
  );

  type Item = {
    type: string;
    content?: { type: string; text?: string; annotations?: { url?: string; title?: string }[] }[];
  };
  let text = "";
  let searches = 0;
  const sources: { title: string; url: string }[] = [];
  for (const item of (data.output ?? []) as Item[]) {
    if (item.type === "web_search_call") searches++;
    if (item.type === "message") {
      for (const part of item.content ?? []) {
        if (part.type === "output_text" && part.text) text += part.text;
        for (const a of part.annotations ?? []) {
          if (a.url) sources.push({ title: a.title ?? a.url, url: a.url });
        }
      }
    }
  }
  return {
    text,
    tokensIn: data.usage?.input_tokens ?? 0,
    tokensOut: data.usage?.output_tokens ?? 0,
    searches,
    sources: dedupe(sources),
  };
}

/* ---------- gemini ---------- */

async function gemini(
  cfg: ProviderConfig,
  key: string,
  model: ModelSpec,
  prompt: Prompt,
  track: Track,
): Promise<ProviderResult> {
  const tool = searchToolFor(cfg, track);
  const data = await postJson(
    `${cfg.baseUrl}/models/${model.apiModel}:generateContent`,
    { "x-goog-api-key": key },
    {
      systemInstruction: { parts: [{ text: prompt.system }] },
      contents: [{ role: "user", parts: [{ text: prompt.user }] }],
      generationConfig: { maxOutputTokens: limits.maxOutputTokens },
      ...(tool ? { tools: [{ [tool]: {} }] } : {}),
    },
  );
  const candidate = data.candidates?.[0];
  const text = ((candidate?.content?.parts ?? []) as { text?: string }[])
    .map((p) => p.text ?? "")
    .join("");
  const grounding = candidate?.groundingMetadata;
  const sources = ((grounding?.groundingChunks ?? []) as { web?: { uri?: string; title?: string } }[])
    .filter((c) => c.web?.uri)
    .map((c) => ({ title: c.web!.title ?? c.web!.uri!, url: c.web!.uri! }));
  return {
    text,
    tokensIn: data.usageMetadata?.promptTokenCount ?? 0,
    tokensOut:
      (data.usageMetadata?.candidatesTokenCount ?? 0) + (data.usageMetadata?.thoughtsTokenCount ?? 0),
    // Google bills per search query the model ran.
    searches: (grounding?.webSearchQueries ?? []).length,
    sources: dedupe(sources),
  };
}

/* ---------- chat-completions (closed book only) ---------- */

async function chatCompletions(
  cfg: ProviderConfig,
  key: string,
  model: ModelSpec,
  prompt: Prompt,
): Promise<ProviderResult> {
  const data = await postJson(
    `${cfg.baseUrl}/chat/completions`,
    { authorization: `Bearer ${key}` },
    {
      model: model.apiModel,
      max_tokens: limits.maxOutputTokens,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
    },
  );
  return {
    text: data.choices?.[0]?.message?.content ?? "",
    tokensIn: data.usage?.prompt_tokens ?? 0,
    tokensOut: data.usage?.completion_tokens ?? 0,
    searches: 0,
    sources: [],
  };
}

export async function callProvider(
  model: ModelSpec,
  prompt: Prompt,
  track: Track,
): Promise<ProviderResult> {
  const cfg = providerOf(model.provider);
  const key = apiKey(model.provider);
  if (!key) throw new Error(`${cfg.keyEnv} is not set`);

  switch (cfg.api) {
    case "anthropic-messages":
      return anthropicMessages(cfg, key, model, prompt, track);
    case "responses":
      return responsesApi(cfg, key, model, prompt, track);
    case "gemini":
      return gemini(cfg, key, model, prompt, track);
    case "chat-completions":
      return chatCompletions(cfg, key, model, prompt);
  }
}

/** USD cost of one call, from the configured prices. */
export function costOf(
  model: Pick<ModelSpec, "priceInPerMTok" | "priceOutPerMTok" | "searchPricePer1k">,
  usage: Pick<ProviderResult, "tokensIn" | "tokensOut" | "searches">,
): number {
  return (
    (usage.tokensIn * model.priceInPerMTok) / 1e6 +
    (usage.tokensOut * model.priceOutPerMTok) / 1e6 +
    (usage.searches * model.searchPricePer1k) / 1000
  );
}
