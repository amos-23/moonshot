ALTER TABLE "connect"."moments" DROP CONSTRAINT "moments_not_empty";--> statement-breakpoint
ALTER TABLE "connect"."moments" ADD COLUMN "x_post_url" text;--> statement-breakpoint
ALTER TABLE "connect"."moments" ADD COLUMN "x_author_name" text;--> statement-breakpoint
ALTER TABLE "connect"."moments" ADD COLUMN "x_author_handle" text;--> statement-breakpoint
ALTER TABLE "connect"."moments" ADD COLUMN "x_text" text;--> statement-breakpoint
ALTER TABLE "connect"."moments" ADD COLUMN "x_media" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "connect"."moments" ADD COLUMN "x_avatar_url" text;--> statement-breakpoint
ALTER TABLE "connect"."moments" ADD COLUMN "x_posted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "connect"."moments" ADD CONSTRAINT "moments_not_empty" CHECK ("connect"."moments"."has_photo" or char_length("connect"."moments"."body") > 0 or "connect"."moments"."x_post_url" is not null);