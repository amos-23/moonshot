ALTER TABLE "connect"."social_posts" ADD COLUMN "media" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "connect"."social_posts" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "connect"."social_posts" ADD COLUMN "details_checked_at" timestamp with time zone;