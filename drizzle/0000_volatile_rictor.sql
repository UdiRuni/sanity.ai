CREATE TABLE "forecasts" (
	"id" serial PRIMARY KEY NOT NULL,
	"question_id" integer NOT NULL,
	"model_id" text NOT NULL,
	"track" text NOT NULL,
	"round" integer DEFAULT 0 NOT NULL,
	"probability" double precision NOT NULL,
	"rationale" text NOT NULL,
	"key_factors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"change_mind" text,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tokens_in" integer DEFAULT 0 NOT NULL,
	"tokens_out" integer DEFAULT 0 NOT NULL,
	"searches" integer DEFAULT 0 NOT NULL,
	"cost_usd" double precision DEFAULT 0 NOT NULL,
	"mock" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "models" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"provider" text NOT NULL,
	"api_model" text NOT NULL,
	"tier" text NOT NULL,
	"color" text NOT NULL,
	"supports_open_book" boolean DEFAULT false NOT NULL,
	"price_in_per_mtok" double precision NOT NULL,
	"price_out_per_mtok" double precision NOT NULL,
	"search_price_per_1k" double precision DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"edition" text DEFAULT 'il' NOT NULL,
	"lang" text DEFAULT 'he' NOT NULL,
	"title" jsonb NOT NULL,
	"criteria" jsonb NOT NULL,
	"source_url" text,
	"category" text DEFAULT 'world' NOT NULL,
	"suggested_by" text,
	"suggester_id" text,
	"votes" integer DEFAULT 0 NOT NULL,
	"reject_reason" text,
	"open_at" timestamp with time zone,
	"lock_at" timestamp with time zone,
	"resolve_by" timestamp with time zone NOT NULL,
	"outcome" boolean,
	"resolution_url" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"question_id" integer NOT NULL,
	"voter_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "votes_question_id_voter_id_pk" PRIMARY KEY("question_id","voter_id")
);
--> statement-breakpoint
ALTER TABLE "forecasts" ADD CONSTRAINT "forecasts_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forecasts" ADD CONSTRAINT "forecasts_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "forecasts_unique_round" ON "forecasts" USING btree ("question_id","model_id","track","round");--> statement-breakpoint
CREATE UNIQUE INDEX "questions_slug_idx" ON "questions" USING btree ("slug");