CREATE TABLE "connect"."moment_photos" (
	"moment_id" uuid PRIMARY KEY NOT NULL,
	"mime" text NOT NULL,
	"data" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connect"."moments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid,
	"name" text,
	"x_handle" text,
	"body" text DEFAULT '' NOT NULL,
	"place" text,
	"has_photo" boolean DEFAULT false NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"visitor" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "moments_body_len" CHECK (char_length("connect"."moments"."body") <= 280),
	CONSTRAINT "moments_not_empty" CHECK ("connect"."moments"."has_photo" or char_length("connect"."moments"."body") > 0)
);
--> statement-breakpoint
ALTER TABLE "connect"."moment_photos" ADD CONSTRAINT "moment_photos_moment_id_moments_id_fk" FOREIGN KEY ("moment_id") REFERENCES "connect"."moments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connect"."moments" ADD CONSTRAINT "moments_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "connect"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "moments_created_idx" ON "connect"."moments" USING btree ("created_at");