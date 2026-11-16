CREATE TABLE "market_prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"question_id" integer NOT NULL,
	"probability" double precision NOT NULL,
	"source" text NOT NULL,
	"mock" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "market_url" text;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "market_source" text;--> statement-breakpoint
ALTER TABLE "market_prices" ADD CONSTRAINT "market_prices_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;