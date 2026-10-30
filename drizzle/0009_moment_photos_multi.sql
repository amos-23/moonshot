ALTER TABLE "connect"."moment_photos" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "connect"."moment_photos" DROP CONSTRAINT IF EXISTS "moment_photos_pkey";--> statement-breakpoint
ALTER TABLE "connect"."moment_photos" ADD CONSTRAINT "moment_photos_moment_id_position_pk" PRIMARY KEY("moment_id","position");--> statement-breakpoint
ALTER TABLE "connect"."moments" ADD COLUMN "photo_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "connect"."moments" SET "photo_count" = 1 WHERE "has_photo";
