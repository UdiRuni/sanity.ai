import type { Track } from "@/lib/site";
import type { ModelSpec } from "./registry";

/**
 * One adapter per provider. Each takes the shared prompt and returns raw text
 * plus usage, so cost can be logged for every call.
 *
 * STATUS: the Anthropic request shape was checked against the official docs
 * (web_search_20250305, usage.server_tool_use.web_search_requests). The OpenAI,
 * Google, xAI and OpenRouter shapes are written from their public API
 * conventions and have NOT been run against live keys. Expect to adjust
 * field names on first contact.
 */

export type ProviderResult = {
  text: string;
  tokensIn: number;
  tokensOut: number;
  searches: number;
  sources: { title: string; url: string }[];
};

type Prompt = { system: string; user: string };

const MAX_SEARCHES = 5;
const MAX_OUTPUT_TOKENS = 4000;
const TIMEOUT_MS = 180_000;

async function postJson(url: string, headers: Record<string, string>, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${url} responded ${res.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text);
}

function dedupe(sources: { title: string; url: string }[]) {
  const seen = new Set<string>();
  return sources.filter((s) => s.url && !seen.has(s.url) && seen.add(s.url)).slice(0, 8);
}

/* ---------- Anthropic ---------- */

async function anthropic(model: ModelSpec, prompt: Prompt, track: Track): Promise<ProviderResult> {
  const headers = {
    "x-api-key": process.env.ANTHROPIC_API_KEY!,
    "anthropic-version": "2023-06-01",
  };
  const tools =
    track === "open"
      ? [{ type: "web_search_20250305", name: "web_search", max_uses: MAX_SEARCHES }]
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
    const data = await postJson("https://api.anthropic.com/v1/messages", headers, {
      model: model.apiModel,
      max_tokens: MAX_OUTPUT_TOKENS,
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

/* ---------- OpenAI and xAI (Responses API shape) ---------- */

async function responsesApi(
  baseUrl: string,
  apiKey: string,
  model: ModelSpec,
  prompt: Prompt,
  track: Track,
): Promise<ProviderResult> {
  const data = await postJson(
    `${baseUrl}/responses`,
    { authorization: `Bearer ${apiKey}` },
    {
      model: model.apiModel,
      instructions: prompt.system,
      input: prompt.user,
      max_output_tokens: MAX_OUTPUT_TOKENS,
      ...(track === "open" ? { tools: [{ type: "web_search" }], max_tool_calls: MAX_SEARCHES } : {}),
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

/* ---------- Google Gemini ---------- */

async function google(model: ModelSpec, prompt: Prompt, track: Track): Promise<ProviderResult> {
  const data = await postJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${model.apiModel}:generateContent`,
    { "x-goog-api-key": process.env.GEMINI_API_KEY! },
    {
      systemInstruction: { parts: [{ text: prompt.system }] },
      contents: [{ role: "user", parts: [{ text: prompt.user }] }],
      generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS },
      ...(track === "open" ? { tools: [{ google_search: {} }] } : {}),
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

/* ---------- OpenRouter (chat completions, closed book only) ---------- */

async function openrouter(model: ModelSpec, prompt: Prompt): Promise<ProviderResult> {
  const data = await postJson(
    "https://openrouter.ai/api/v1/chat/completions",
    { authorization: `Bearer ${process.env.OPENROUTER_API_KEY!}` },
    {
      model: model.apiModel,
      max_tokens: MAX_OUTPUT_TOKENS,
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
  switch (model.provider) {
    case "anthropic":
      return anthropic(model, prompt, track);
    case "openai":
      return responsesApi("https://api.openai.com/v1", process.env.OPENAI_API_KEY!, model, prompt, track);
    case "xai":
      return responsesApi("https://api.x.ai/v1", process.env.XAI_API_KEY!, model, prompt, track);
    case "google":
      return google(model, prompt, track);
    case "openrouter":
      return openrouter(model, prompt);
  }
}

/** USD cost of one call, from the registry prices. */
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
