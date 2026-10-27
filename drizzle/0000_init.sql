CREATE TABLE "hangout_members" (
	"hangout_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hangout_members_hangout_id_person_id_pk" PRIMARY KEY("hangout_id","person_id")
);
--> statement-breakpoint
CREATE TABLE "hangouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"host_id" uuid NOT NULL,
	"title" text NOT NULL,
	"details" text DEFAULT '' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"place" text NOT NULL,
	"capacity" integer DEFAULT 12 NOT NULL,
	"cancelled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hangouts_capacity_check" CHECK ("hangouts"."capacity" between 2 and 200)
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"edit_token_hash" text NOT NULL,
	"name" text NOT NULL,
	"headline" text NOT NULL,
	"company" text,
	"bio" text DEFAULT '' NOT NULL,
	"wants" text[] DEFAULT '{}'::text[] NOT NULL,
	"offers" text[] DEFAULT '{}'::text[] NOT NULL,
	"interests" text[] DEFAULT '{}'::text[] NOT NULL,
	"attendance" text DEFAULT 'in_person' NOT NULL,
	"x_handle" text,
	"linkedin_url" text,
	"whatsapp" text,
	"email" text,
	"website_url" text,
	"where_note" text,
	"where_updated_at" timestamp with time zone,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "people_attendance_check" CHECK ("people"."attendance" in ('in_person','remote')),
	CONSTRAINT "people_name_len" CHECK (char_length("people"."name") between 1 and 60)
);
--> statement-breakpoint
CREATE TABLE "rate_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"reporter_id" uuid,
	"resolved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text NOT NULL,
	"url" text NOT NULL,
	"author_handle" text,
	"author_name" text,
	"content" text,
	"posted_at" timestamp with time zone,
	"themes" text[] DEFAULT '{}'::text[] NOT NULL,
	"source" text NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hangout_members" ADD CONSTRAINT "hangout_members_hangout_id_hangouts_id_fk" FOREIGN KEY ("hangout_id") REFERENCES "public"."hangouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hangout_members" ADD CONSTRAINT "hangout_members_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hangouts" ADD CONSTRAINT "hangouts_host_id_people_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hangouts_starts_idx" ON "hangouts" USING btree ("starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "people_token_key" ON "people" USING btree ("edit_token_hash");--> statement-breakpoint
CREATE INDEX "people_created_idx" ON "people" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "rate_events_key_idx" ON "rate_events" USING btree ("key","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "social_posts_external_key" ON "social_posts" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "social_posts_posted_idx" ON "social_posts" USING btree ("posted_at");