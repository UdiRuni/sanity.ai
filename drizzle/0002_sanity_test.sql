CREATE TABLE "sanity_probes" (
	"id" serial PRIMARY KEY NOT NULL,
	"test_id" integer NOT NULL,
	"model_id" text NOT NULL,
	"variant" text NOT NULL,
	"probability" double precision NOT NULL,
	"rationale" text NOT NULL,
	"tokens_in" integer DEFAULT 0 NOT NULL,
	"tokens_out" integer DEFAULT 0 NOT NULL,
	"cost_usd" double precision DEFAULT 0 NOT NULL,
	"mock" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sanity_tests" (
	"id" serial PRIMARY KEY NOT NULL,
	"question_id" integer NOT NULL,
	"batch" integer DEFAULT 0 NOT NULL,
	"prompt_version" text NOT NULL,
	"asked_on" timestamp with time zone NOT NULL,
	"earlier_by" timestamp with time zone,
	"translate_to" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "event_by_deadline" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sanity_probes" ADD CONSTRAINT "sanity_probes_test_id_sanity_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."sanity_tests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sanity_probes" ADD CONSTRAINT "sanity_probes_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sanity_tests" ADD CONSTRAINT "sanity_tests_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sanity_probes_unique" ON "sanity_probes" USING btree ("test_id","model_id","variant");--> statement-breakpoint
CREATE UNIQUE INDEX "sanity_tests_question_batch" ON "sanity_tests" USING btree ("question_id","batch");