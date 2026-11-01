ALTER TABLE "connect"."event_spaces" ADD COLUMN "listed" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "connect"."event_spaces" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "connect"."event_spaces" ADD COLUMN "brand_color" text;