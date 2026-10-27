CREATE TABLE "connect"."events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"path" text NOT NULL,
	"target" text,
	"target_id" uuid,
	"referrer" text,
	"visitor" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_type_check" CHECK ("connect"."events"."type" in ('view','click'))
);
--> statement-breakpoint
CREATE INDEX "events_type_created_idx" ON "connect"."events" USING btree ("type","created_at");