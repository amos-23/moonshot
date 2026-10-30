CREATE TABLE "connect"."signups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"about" text,
	"person_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "signups_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "connect"."signups" ADD CONSTRAINT "signups_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "connect"."people"("id") ON DELETE set null ON UPDATE no action;