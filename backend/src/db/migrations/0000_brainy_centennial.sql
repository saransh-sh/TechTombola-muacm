CREATE TYPE "public"."user_role" AS ENUM('SUPER_ADMIN', 'ADMIN', 'PARTICIPANT');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('DRAFT', 'READY', 'LIVE', 'COMPLETED', 'PAUSED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."round_status" AS ENUM('DRAFT', 'READY', 'ACTIVE', 'COMPLETED', 'PAUSED', 'RECOVERY_REQUIRED');--> statement-breakpoint
CREATE TYPE "public"."pattern_status" AS ENUM('OPEN', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."pattern_type" AS ENUM('EARLY_5', 'TOP_LINE', 'MIDDLE_LINE', 'BOTTOM_LINE', 'FULL_HOUSE');--> statement-breakpoint
CREATE TYPE "public"."claim_status" AS ENUM('SUBMITTED', 'PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'REJECTED_PATTERN_ALREADY_CLOSED');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'PARTICIPANT' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"status" "event_status" DEFAULT 'DRAFT' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"round_number" integer NOT NULL,
	"status" "round_status" DEFAULT 'DRAFT' NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"value" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"key_id" uuid NOT NULL,
	"prompt" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"participant_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_cells" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"row_idx" integer NOT NULL,
	"col_idx" integer NOT NULL,
	"key_id" uuid,
	"is_marked" boolean DEFAULT false NOT NULL,
	"marked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "draws" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"key_id" uuid NOT NULL,
	"sequence_number" integer NOT NULL,
	"drawn_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "winning_patterns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"pattern" "pattern_type" NOT NULL,
	"status" "pattern_status" DEFAULT 'OPEN' NOT NULL,
	"max_winners" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "win_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"pattern" "pattern_type" NOT NULL,
	"status" "claim_status" DEFAULT 'SUBMITTED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "winners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"pattern" "pattern_type" NOT NULL,
	"claim_id" uuid NOT NULL,
	"verified_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" varchar(100) NOT NULL,
	"resource_type" varchar(100) NOT NULL,
	"resource_id" varchar(255),
	"metadata" jsonb,
	"ip_address" varchar(45),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keys" ADD CONSTRAINT "keys_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_key_id_keys_id_fk" FOREIGN KEY ("key_id") REFERENCES "public"."keys"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_participant_id_users_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_cells" ADD CONSTRAINT "ticket_cells_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_cells" ADD CONSTRAINT "ticket_cells_key_id_keys_id_fk" FOREIGN KEY ("key_id") REFERENCES "public"."keys"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draws" ADD CONSTRAINT "draws_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draws" ADD CONSTRAINT "draws_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draws" ADD CONSTRAINT "draws_key_id_keys_id_fk" FOREIGN KEY ("key_id") REFERENCES "public"."keys"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "winning_patterns" ADD CONSTRAINT "winning_patterns_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "win_claims" ADD CONSTRAINT "win_claims_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "win_claims" ADD CONSTRAINT "win_claims_participant_id_users_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "winners" ADD CONSTRAINT "winners_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "winners" ADD CONSTRAINT "winners_participant_id_users_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "winners" ADD CONSTRAINT "winners_claim_id_win_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."win_claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rounds_event_id_idx" ON "rounds" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "keys_event_id_value_unique" ON "keys" USING btree ("event_id","value");--> statement-breakpoint
CREATE INDEX "keys_event_id_idx" ON "keys" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "questions_round_id_idx" ON "questions" USING btree ("round_id");--> statement-breakpoint
CREATE INDEX "questions_key_id_idx" ON "questions" USING btree ("key_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tickets_participant_round_unique" ON "tickets" USING btree ("participant_id","round_id");--> statement-breakpoint
CREATE INDEX "tickets_participant_id_idx" ON "tickets" USING btree ("participant_id");--> statement-breakpoint
CREATE INDEX "tickets_round_id_idx" ON "tickets" USING btree ("round_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_cells_ticket_row_col_unique" ON "ticket_cells" USING btree ("ticket_id","row_idx","col_idx");--> statement-breakpoint
CREATE INDEX "ticket_cells_ticket_id_idx" ON "ticket_cells" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "ticket_cells_key_id_idx" ON "ticket_cells" USING btree ("key_id");--> statement-breakpoint
CREATE UNIQUE INDEX "draws_round_question_unique" ON "draws" USING btree ("round_id","question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "draws_round_sequence_unique" ON "draws" USING btree ("round_id","sequence_number");--> statement-breakpoint
CREATE INDEX "draws_round_id_idx" ON "draws" USING btree ("round_id");--> statement-breakpoint
CREATE UNIQUE INDEX "winning_patterns_round_pattern_unique" ON "winning_patterns" USING btree ("round_id","pattern");--> statement-breakpoint
CREATE INDEX "winning_patterns_round_id_idx" ON "winning_patterns" USING btree ("round_id");--> statement-breakpoint
CREATE INDEX "win_claims_round_id_idx" ON "win_claims" USING btree ("round_id");--> statement-breakpoint
CREATE INDEX "win_claims_participant_id_idx" ON "win_claims" USING btree ("participant_id");--> statement-breakpoint
CREATE INDEX "win_claims_status_idx" ON "win_claims" USING btree ("status");--> statement-breakpoint
CREATE INDEX "winners_round_id_idx" ON "winners" USING btree ("round_id");--> statement-breakpoint
CREATE INDEX "winners_participant_id_idx" ON "winners" USING btree ("participant_id");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");