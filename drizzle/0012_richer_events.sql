ALTER TABLE "connect"."events" DROP CONSTRAINT "events_type_check";--> statement-breakpoint
ALTER TABLE "connect"."events" ADD COLUMN "device" text;--> statement-breakpoint
ALTER TABLE "connect"."events" ADD COLUMN "campaign" text;--> statement-breakpoint
ALTER TABLE "connect"."events" ADD COLUMN "returning" boolean;--> statement-breakpoint
ALTER TABLE "connect"."events" ADD COLUMN "ms" integer;--> statement-breakpoint
ALTER TABLE "connect"."events" ADD CONSTRAINT "events_type_check" CHECK ("connect"."events"."type" in ('view','click','search','leave'));