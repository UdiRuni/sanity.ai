/**
 * Connection check: sends one tiny forecast request to every model in
 * sanity.config.ts and reports which ones answer.
 *
 *   npm run check:models             closed-book call to every model
 *   npm run check:models -- --search also tests web search on open-book models
 *   npm run check:models -- gpt-sol  only the named model ids
 *
 * A full run costs a few cents. Models whose provider key is missing are skipped.
 */
import { existsSync } from "node:fs";
import { models, providers } from "../sanity.config";
import { parseForecast } from "../src/engine/parse";
import { buildPrompt } from "../src/engine/prompt";
import { callProvider, costOf } from "../src/engine/providers";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

const args = process.argv.slice(2);
const withSearch = args.includes("--search");
const only = args.filter((a) => !a.startsWith("--"));

const question = {
  title: "Will the sun rise tomorrow in Tel Aviv?",
  criteria: "The sun rises tomorrow in Tel Aviv.",
  resolveBy: new Date(Date.now() + 2 * 86400000),
  lang: "en",
};

type Row = { model: string; track: string; status: string; detail: string };

async function main() {
  const rows: Row[] = [];
  let total = 0;
  const selected = models.filter((m) => only.length === 0 || only.includes(m.id));
  if (selected.length === 0) {
    console.error(`No model matches: ${only.join(", ")}. Known ids: ${models.map((m) => m.id).join(", ")}`);
    process.exit(2);
  }

  for (const model of selected) {
    const provider = providers[model.provider];
    const trackList = withSearch && model.supportsOpenBook ? (["closed", "open"] as const) : (["closed"] as const);

    for (const track of trackList) {
      if (!process.env[provider.keyEnv]) {
        rows.push({
          model: model.id,
          track,
          status: "SKIPPED",
          detail: `${provider.keyEnv} is not set. Create a key at ${provider.keysUrl}`,
        });
        continue;
      }
      try {
        const started = Date.now();
        const result = await callProvider(model, buildPrompt(question, track, new Date()), track);
        const forecast = parseForecast(result.text);
        const cost = costOf(model, result);
        total += cost;
        rows.push({
          model: model.id,
          track,
          status: "OK",
          detail: `p=${forecast.probability} tokens=${result.tokensIn}/${result.tokensOut} searches=${result.searches} $${cost.toFixed(4)} ${Date.now() - started}ms`,
        });
      } catch (err) {
        rows.push({
          model: model.id,
          track,
          status: "FAILED",
          detail: (err instanceof Error ? err.message : String(err)).slice(0, 300),
        });
      }
    }
  }

  const width = Math.max(...rows.map((r) => r.model.length));
  for (const r of rows) {
    console.log(`${r.status.padEnd(8)} ${r.model.padEnd(width)}  ${r.track.padEnd(6)}  ${r.detail}`);
  }
  const failed = rows.filter((r) => r.status === "FAILED").length;
  const ok = rows.filter((r) => r.status === "OK").length;
  const skipped = rows.filter((r) => r.status === "SKIPPED").length;
  console.log(`\n${ok} ok, ${failed} failed, ${skipped} skipped. Spent about $${total.toFixed(4)}.`);
  if (failed) {
    console.log("A FAILED row with 404 or 'model not found' usually means the apiModel id in sanity.config.ts is wrong.");
    process.exit(1);
  }
}

main();
