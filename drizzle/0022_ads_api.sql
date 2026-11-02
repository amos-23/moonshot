-- Backend for AdsSim (ads.latars.xyz). Kept in its own Postgres schema, with its own users and sessions:
-- nothing here is shared with the events app's accounts.
CREATE SCHEMA IF NOT EXISTS "ads";--> statement-breakpoint
CREATE TABLE "ads"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ads_users_email_unique" UNIQUE("email")
);--> statement-breakpoint
CREATE TABLE "ads"."sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "ads"."users"("id") ON DELETE cascade,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "ads_sessions_user_idx" ON "ads"."sessions" ("user_id");--> statement-breakpoint
CREATE TABLE "ads"."progress" (
	"user_id" uuid PRIMARY KEY NOT NULL REFERENCES "ads"."users"("id") ON DELETE cascade,
	"state" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "ads"."events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"platform" text,
	"props" jsonb,
	"visitor" text NOT NULL,
	"signed_in" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "ads_events_name_idx" ON "ads"."events" ("name","created_at");
