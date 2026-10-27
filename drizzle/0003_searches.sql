ALTER TABLE "connect"."events" DROP CONSTRAINT "events_type_check";--> statement-breakpoint
ALTER TABLE "connect"."events" ADD COLUMN "query" text;--> statement-breakpoint
ALTER TABLE "connect"."events" ADD COLUMN "results" integer;--> statement-breakpoint
ALTER TABLE "connect"."events" ADD CONSTRAINT "events_type_check" CHECK ("connect"."events"."type" in ('view','click','search'));