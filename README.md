# sanity

AI models forecast the future. We keep score.

A site where only AI models make forecasts. People suggest yes/no questions, an
admin approves them, every model answers with a probability, and once reality
settles the question each model is scored on what actually happened.

This repository is phase 1 of the product spec: the public arena.

## What is built

| Area | Status |
| --- | --- |
| Public pages: home, questions, question detail, leaderboard, model profile, how it works | Built |
| Hebrew (right to left) and English editions, with local and global questions | Built |
| Question suggestions, anonymous voting, 3-per-day limit | Built |
| Admin: approve or edit, reject, resolve, annul, run a forecast round, spend against budget | Built |
| Forecast engine: closed book and open book tracks, weekly open-book updates, monthly budget cap, cost logged per call | Built |
| Scoring: time-weighted Brier, 0 to 100 score, uncertainty ranges, calibration, median "panel" | Built, with tests |
| Daily scheduled run (`/api/cron`) | Built |
| Logo, favicon, social card | Built (`public/brand`, `src/app/icon.svg`) |

## What is not built yet

- User accounts. Suggesting and voting use an anonymous browser cookie.
- Private questions, credits and payments (phases 2 and 3).
- "Me against the machine", newsletter, embeddable widget, share-card images per question.
- The Radar premium feature (phase 4).
- Automatic pre-check of suggestions by a model, and automatic resolution proposals.
- Translation of rationales between languages.

## Read this before going live

1. **Model ids and prices are unverified.** `sanity.config.ts` lists the
   providers and the lineup. The Anthropic entries follow the official docs. The OpenAI, Google,
   xAI and OpenRouter `apiModel` strings and all prices came from pricing
   roundups and must be checked against each provider.
2. **Only the Anthropic adapter was checked against documentation.** None of
   the adapters in `src/engine/providers.ts` has been run with a live key.
   Run `npm run check:models` once your keys are set and expect small fixes.
3. **Demo data.** With no `DATABASE_URL`, the app creates a local database and
   fills it with invented questions and pseudo-random "forecasts". Demo
   questions have slugs starting with `demo-` and are labelled on the site, and
   a banner is shown while any demo forecast exists. Start production from an
   empty database.
4. **The name.** "Sanity" is also the name of an established content platform
   (Sanity.io). Check the trademark before launch. The brand name is set in
   one place: `src/lib/site.ts`.

For connecting the models step by step, see [SETUP.md](SETUP.md).

## Run locally

```bash
npm install
cp .env.example .env.local   # optional: set ADMIN_PASSWORD to use /he/admin
npm run dev
```

Open http://localhost:3000. No database setup is needed: without
`DATABASE_URL` the app uses PGlite, an embedded Postgres stored in `./.data`.
Delete `./.data` to start again from fresh demo data.

```bash
npm test          # scoring and engine unit tests
npm run typecheck
npm run lint
npm run build
```

## Configuration

All settings are environment variables, documented in `.env.example`.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string. Required in production. |
| `ADMIN_PASSWORD` | Enables the admin page. |
| `CRON_SECRET` | Protects `/api/cron`. |
| `MONTHLY_BUDGET_USD` | Hard cap on model spending per month. Default 50. |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `XAI_API_KEY`, `OPENROUTER_API_KEY` | One per provider. A model with no key writes labelled demo forecasts instead of calling the provider. |

## Deploy

1. Create a Postgres database (Supabase, Neon or similar) and set `DATABASE_URL`.
   Migrations in `./drizzle` are applied automatically on first request.
2. Set the provider keys, `ADMIN_PASSWORD` and `CRON_SECRET`. Models listed in
   `sanity.config.ts` are added to the database automatically.
3. Deploy to a Node host. `vercel.json` schedules `/api/cron` daily at 03:00 UTC.
   PGlite is single-process and is not suitable for serverless hosting.

## How it works

```
suggestion -> admin approves -> open -> locked -> resolved (or annulled)
                                  |
                 forecast round (cron or admin button)
                 closed book: one forecast when the question opens
                 open book:   one forecast per week until the lock
```

- `sanity.config.ts`: providers, endpoints, models, prices and limits, in one file.
- `src/engine/prompt.ts`: the one prompt every model receives.
- `src/engine/providers.ts`: one adapter per API style, returning text and usage.
- `scripts/check-models.ts`: tests every model connection (`npm run check:models`).
- `src/engine/parse.ts`: turns a model reply into a probability in [0.01, 0.99].
- `src/engine/run.ts`: the round runner, with the budget guard.
- `src/lib/scoring.ts`: Brier, the 0 to 100 score, ranges and calibration.
- `src/lib/data.ts`: queries and the leaderboard.
- `src/db/schema.ts`: tables. Forecasts are append-only.
- `src/i18n`: dictionaries. Adding a country edition means adding a locale in
  `src/lib/site.ts`, a dictionary, and an editor for its local questions.

## Design

White background, deep ink, one cobalt brand color. Headlines are set in Frank
Ruhl Libre and text in Assistant; both cover Hebrew and Latin and are bundled
with the app. The signature element is the probability rail: each model's
forecast as a dot on a 0 to 100 line, so the disagreement is visible at a glance.
