import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/** Text stored per language. The original language is always present. */
export type Localized = Partial<Record<string, string>>;

export type QuestionStatus =
  | "pending" // suggested, waiting for the admin
  | "rejected"
  | "open" // approved, models are forecasting
  | "locked" // forecasts frozen, waiting for the outcome
  | "resolved"
  | "annulled";

export const models = pgTable("models", {
  id: text("id").primaryKey(), // stable slug, e.g. "claude-opus"
  name: text("name").notNull(),
  provider: text("provider").notNull(), // anthropic | openai | google | xai | openrouter
  apiModel: text("api_model").notNull(), // exact model version sent to the provider
  tier: text("tier").notNull(), // flagship | light | open
  color: text("color").notNull(), // identity color, fixed for the model's lifetime
  supportsOpenBook: boolean("supports_open_book").notNull().default(false),
  priceInPerMTok: doublePrecision("price_in_per_mtok").notNull(),
  priceOutPerMTok: doublePrecision("price_out_per_mtok").notNull(),
  searchPricePer1k: doublePrecision("search_price_per_1k").notNull().default(0),
  active: boolean("active").notNull().default(true),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
});

export const questions = pgTable(
  "questions",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    status: text("status").$type<QuestionStatus>().notNull().default("pending"),
    edition: text("edition").notNull().default("il"), // "global" or a country code
    lang: text("lang").notNull().default("he"), // language the question was written in
    title: jsonb("title").$type<Localized>().notNull(),
    criteria: jsonb("criteria").$type<Localized>().notNull(), // how it resolves
    sourceUrl: text("source_url"), // where the outcome will be published
    // Optional link to the same question on a prediction market. When set, the
    // market's price is tracked and scored like one more competitor.
    marketUrl: text("market_url"),
    marketSource: text("market_source"), // key in sanity.config.ts markets, or "manual"
    // True when the question asks whether something happens on or before its
    // resolution date. Then the chance of YES by an earlier date can only be
    // lower, which the sanity test's deadline check relies on. Set by the admin.
    eventByDeadline: boolean("event_by_deadline").notNull().default(false),
    category: text("category").notNull().default("world"),
    suggestedBy: text("suggested_by"), // display name
    suggesterId: text("suggester_id"), // anonymous browser id, for rate limiting
    votes: integer("votes").notNull().default(0),
    rejectReason: text("reject_reason"),
    openAt: timestamp("open_at", { withTimezone: true }),
    lockAt: timestamp("lock_at", { withTimezone: true }),
    resolveBy: timestamp("resolve_by", { withTimezone: true }).notNull(),
    outcome: boolean("outcome"), // true = yes, false = no, null = not resolved
    resolutionUrl: text("resolution_url"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("questions_slug_idx").on(t.slug)],
);

/**
 * Forecasts are append-only. A forecast is never edited after it is written:
 * that rule is what makes the leaderboard trustworthy.
 */
export const forecasts = pgTable(
  "forecasts",
  {
    id: serial("id").primaryKey(),
    questionId: integer("question_id")
      .notNull()
      .references(() => questions.id),
    modelId: text("model_id")
      .notNull()
      .references(() => models.id),
    track: text("track").notNull(), // closed | open
    round: integer("round").notNull().default(0),
    probability: doublePrecision("probability").notNull(), // 0.01 to 0.99
    rationale: text("rationale").notNull(),
    keyFactors: jsonb("key_factors").$type<string[]>().notNull().default([]),
    changeMind: text("change_mind"),
    sources: jsonb("sources").$type<{ title: string; url: string }[]>().notNull().default([]),
    tokensIn: integer("tokens_in").notNull().default(0),
    tokensOut: integer("tokens_out").notNull().default(0),
    searches: integer("searches").notNull().default(0),
    costUsd: doublePrecision("cost_usd").notNull().default(0),
    mock: boolean("mock").notNull().default(false), // true = demo data, no real model call
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("forecasts_unique_round").on(t.questionId, t.modelId, t.track, t.round),
  ],
);

/** Market price snapshots. Append-only, like forecasts. */
export const marketPrices = pgTable("market_prices", {
  id: serial("id").primaryKey(),
  questionId: integer("question_id")
    .notNull()
    .references(() => questions.id),
  probability: doublePrecision("probability").notNull(), // price of YES, 0 to 1
  source: text("source").notNull(),
  mock: boolean("mock").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** The mirror versions of a question that the sanity test asks. */
export type SanityVariantName =
  | "base" // the question as it is
  | "negated" // "will the answer be NO?"
  | "earlier" // the same question with an earlier deadline
  | "translated" // the same question in another language
  | "leanYes" // the asker says they are sure the answer is yes
  | "leanNo"; // the asker says they are sure the answer is no

/**
 * One sanity test per question (batch 0; the column leaves room for repeats).
 * The plan is fixed when the test starts, so every model gets the same
 * prompts with the same date, whenever its calls happen.
 */
export const sanityTests = pgTable(
  "sanity_tests",
  {
    id: serial("id").primaryKey(),
    questionId: integer("question_id")
      .notNull()
      .references(() => questions.id),
    batch: integer("batch").notNull().default(0),
    promptVersion: text("prompt_version").notNull(),
    askedOn: timestamp("asked_on", { withTimezone: true }).notNull(), // "today" in every prompt
    earlierBy: timestamp("earlier_by", { withTimezone: true }), // null: no deadline check
    translateTo: text("translate_to"), // null: no language check
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("sanity_tests_question_batch").on(t.questionId, t.batch)],
);

/** One model's answer to one variant. Append-only, like forecasts. */
export const sanityProbes = pgTable(
  "sanity_probes",
  {
    id: serial("id").primaryKey(),
    testId: integer("test_id")
      .notNull()
      .references(() => sanityTests.id),
    modelId: text("model_id")
      .notNull()
      .references(() => models.id),
    variant: text("variant").$type<SanityVariantName>().notNull(),
    probability: doublePrecision("probability").notNull(), // probability the variant resolves YES
    rationale: text("rationale").notNull(),
    tokensIn: integer("tokens_in").notNull().default(0),
    tokensOut: integer("tokens_out").notNull().default(0),
    costUsd: doublePrecision("cost_usd").notNull().default(0),
    mock: boolean("mock").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("sanity_probes_unique").on(t.testId, t.modelId, t.variant)],
);

export const votes = pgTable(
  "votes",
  {
    questionId: integer("question_id")
      .notNull()
      .references(() => questions.id),
    voterId: text("voter_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.questionId, t.voterId] })],
);

export type Model = typeof models.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type Forecast = typeof forecasts.$inferSelect;
export type MarketPrice = typeof marketPrices.$inferSelect;
export type SanityTest = typeof sanityTests.$inferSelect;
export type SanityProbe = typeof sanityProbes.$inferSelect;
