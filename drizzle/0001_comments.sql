CREATE TABLE "connect"."comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"person_id" uuid,
	"name" text NOT NULL,
	"body" text NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comments_body_len" CHECK (char_length("connect"."comments"."body") between 1 and 280)
);
--> statement-breakpoint
ALTER TABLE "connect"."comments" ADD CONSTRAINT "comments_post_id_social_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "connect"."social_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connect"."comments" ADD CONSTRAINT "comments_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "connect"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comments_post_idx" ON "connect"."comments" USING btree ("post_id","created_at");