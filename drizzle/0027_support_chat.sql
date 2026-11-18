-- Support chat for AdsSim and Event Connect: one thread per visitor per project, answered from the admin.
-- A visitor is identified only by a random token kept in their browser; just its hash is stored here.
CREATE SCHEMA IF NOT EXISTS "support";--> statement-breakpoint
CREATE TABLE "support"."threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project" text NOT NULL,
	"visitor_hash" text NOT NULL,
	"name" text,
	"email" text,
	"page" text,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_user_at" timestamp with time zone,
	"admin_read_at" timestamp with time zone,
	"visitor_seen_at" timestamp with time zone,
	"admin_notified_at" timestamp with time zone,
	"visitor_notified_at" timestamp with time zone,
	CONSTRAINT "support_threads_project_check" CHECK ("project" IN ('ads','connect')),
	CONSTRAINT "support_threads_status_check" CHECK ("status" IN ('open','closed')),
	CONSTRAINT "support_threads_visitor_unique" UNIQUE ("project","visitor_hash")
);--> statement-breakpoint
CREATE INDEX "support_threads_recent_idx" ON "support"."threads" ("last_message_at");--> statement-breakpoint
CREATE TABLE "support"."messages" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"thread_id" uuid NOT NULL REFERENCES "support"."threads"("id") ON DELETE cascade,
	"sender" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_messages_sender_check" CHECK ("sender" IN ('user','admin'))
);--> statement-breakpoint
CREATE INDEX "support_messages_thread_idx" ON "support"."messages" ("thread_id","id");
