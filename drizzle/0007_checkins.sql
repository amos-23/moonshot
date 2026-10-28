CREATE TABLE "connect"."checkins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid,
	"name" text NOT NULL,
	"headline" text,
	"x_handle" text,
	"whatsapp" text,
	"email" text,
	"linkedin_url" text,
	"website_url" text,
	"place" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"hidden" boolean DEFAULT false NOT NULL,
	"visitor" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "checkins_note_len" CHECK (char_length("connect"."checkins"."note") <= 140)
);
--> statement-breakpoint
ALTER TABLE "connect"."checkins" ADD CONSTRAINT "checkins_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "connect"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "checkins_expires_idx" ON "connect"."checkins" USING btree ("expires_at");