CREATE TABLE "connect"."photos" (
	"person_id" uuid PRIMARY KEY NOT NULL,
	"mime" text NOT NULL,
	"data" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "connect"."people" ADD COLUMN "photo_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "connect"."photos" ADD CONSTRAINT "photos_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "connect"."people"("id") ON DELETE cascade ON UPDATE no action;