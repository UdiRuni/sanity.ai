# Setup: connect the models

About 15 minutes. Everything about providers and models lives in one file,
`sanity.config.ts`. API keys live in `.env.local`, never in the config file.

## 1. Install

```bash
npm install
cp .env.example .env.local
```

## 2. Create API keys

Create a key at each provider and paste it into `.env.local`. You can start
with one provider; models without a key are skipped.

| Provider | Models it powers | Create a key | Variable in `.env.local` |
| --- | --- | --- | --- |
| Anthropic | Claude Opus, Claude Haiku | https://platform.claude.com/settings/keys | `ANTHROPIC_API_KEY` |
| OpenAI | GPT Sol, GPT Luna | https://platform.openai.com/api-keys | `OPENAI_API_KEY` |
| Google | Gemini | https://aistudio.google.com/apikey | `GEMINI_API_KEY` |
| xAI | Grok | https://console.x.ai | `XAI_API_KEY` |
| OpenRouter | DeepSeek, Llama | https://openrouter.ai/keys | `OPENROUTER_API_KEY` |

Each provider needs billing enabled and a small prepaid balance. Set a spending
limit in each provider's console as a second safety net.

Also set in `.env.local`:

```
ADMIN_PASSWORD=choose-a-password
MONTHLY_BUDGET_USD=50
SEED_DEMO=false
```

`SEED_DEMO=false` starts with an empty database instead of demo content. If you
already ran the site once, delete the `.data` folder.

## 3. Test the connections

```bash
npm run check:models              # one cheap call per model
npm run check:models -- --search  # also tests web search (costs a few cents)
```

Each model prints `OK`, `FAILED` or `SKIPPED`.

- `FAILED` with 404 or "model not found": the model id is wrong. Open
  `sanity.config.ts`, fix that model's `apiModel` to the id shown in the
  provider's console, and run the check again.
- `FAILED` with 401 or 403: the key is wrong or billing is not enabled.
- `FAILED` with any other message on OpenAI, Google, xAI or OpenRouter: the
  request format may need a small fix in `src/engine/providers.ts`. Those
  adapters have not been run against live APIs yet.

While you are in `sanity.config.ts`, check the prices against each provider's
pricing page. They drive the cost tracking and the budget cap.

## 4. Run the first forecasts

```bash
npm run dev
```

1. Open http://localhost:3000/he/suggest and suggest a question.
2. Open http://localhost:3000/he/admin, sign in, and approve it.
3. Press "Run a forecast round now". The question page now shows real forecasts.

## 5. Compare with a prediction market (optional)

When you approve a question on the admin page, paste the link to the same
question on Polymarket or Kalshi. The site then records the market's price on
every scheduled run and scores it on the leaderboard next to the models. If the
automatic fetch fails, type the current price into the box next to the question
on the admin page.

## 6. Go live

Free to start. About 20 minutes.

**A. Database (Neon)**

1. Sign up at https://neon.com and create a project. Pick a region in Europe.
2. Copy the connection string that starts with `postgresql://`. Use the
   "pooled" one.

**B. Site (Vercel)**

1. Sign up at https://vercel.com with your GitHub account.
2. "Add New" > "Project" > import `UdiRuni/sanity.ai`. Leave the build settings alone.
3. Before deploying, open "Environment Variables" and add:

   | Name | Value |
   | --- | --- |
   | `DATABASE_URL` | the Neon connection string |
   | `ADMIN_PASSWORD` | a password you choose |
   | `CRON_SECRET` | any long random string |
   | `MONTHLY_BUDGET_USD` | `50` |
   | provider keys | the same keys as in `.env.local` |

4. Deploy. The tables are created on the first visit, and the site starts empty.
5. Open `https://<your-site>/he/admin`, sign in, and check the API keys panel.

**C. Schedule (GitHub Actions)**

Vercel's free plan runs a scheduled job once a day and stops any request after
300 seconds, so the forecast runs are driven from GitHub instead. In the
repository on GitHub: Settings > Secrets and variables > Actions.

- Under "Variables" add `SITE_URL` = your site address, e.g. `https://sanity-ai.vercel.app`
- Under "Secrets" add `CRON_SECRET` = the same value you gave Vercel

The "Forecast rounds" workflow then runs every three hours. To run it right
away: Actions > Forecast rounds > Run workflow.

**Good to know**

- A model whose provider key is missing sits out. Nothing fake is written to a
  real database.
- Vercel's free plan is for non-commercial use. Move to Pro before you charge
  or run ads.
- GitHub pauses scheduled workflows in a repository with no activity for 60
  days. Any commit, or pressing "Run workflow", keeps it going.

## 7. Pull request reviews (optional)

The workflow in `.github/workflows/gemini-review.yml` posts a Gemini review on
every pull request. In the GitHub repository settings, add a secret named
`GEMINI_API_KEY`. The default model is `gemini-3.1-pro-preview`; to use a
different one, add a repository variable named
`GEMINI_REVIEW_MODEL`.

## Changing the lineup later

All in `sanity.config.ts`:

- **Add a model:** add an entry to `models` with a new `id`.
- **New model version:** add it as a new entry. Do not edit the old entry's
  `apiModel`, or two track records get mixed.
- **Add a provider:** add an entry to `providers` and pick its `api` style.
  Any OpenAI-compatible provider works with `"responses"` or `"chat-completions"`.
- **Limits:** searches per forecast, token cap, timeout and the default budget
  are in `limits`.
