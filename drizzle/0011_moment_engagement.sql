ALTER TABLE "connect"."moments" ADD COLUMN "x_likes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "connect"."moments" ADD COLUMN "x_replies" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "connect"."moments" ADD COLUMN "x_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "connect"."moments" ADD COLUMN "x_stats_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "connect"."moments" ADD COLUMN "x_video" text;--> statement-breakpoint
ALTER TABLE "connect"."moments" ADD COLUMN "x_video_small" text;--> statement-breakpoint
ALTER TABLE "connect"."moments" ADD COLUMN "x_video_gif" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "connect"."moments" ADD COLUMN "featured_at" timestamp with time zone;