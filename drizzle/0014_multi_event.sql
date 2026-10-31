CREATE TABLE "connect"."event_spaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"short" text NOT NULL,
	"organiser" text,
	"tagline" text,
	"dates" text,
	"venue" text,
	"url" text,
	"x_handle" text,
	"hashtag" text,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"position" integer DEFAULT 100 NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_spaces_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
INSERT INTO "connect"."event_spaces" ("id","slug","name","short","organiser","tagline","dates","venue","url","x_handle","hashtag","starts_at","ends_at","position") VALUES
('00000000-0000-4000-8000-000000000001','moonshot','Moonshot by TechCabal','Moonshot','TechCabal','Courage & Conviction. Building for a new world.','28–29 October 2026','National Theatre, Lagos','https://moonshot.techcabal.com',NULL,'#Moonshot2026','2026-10-27T23:00:00Z','2026-10-29T23:00:00Z',1),
(gen_random_uuid(),'admarp-growth-summit','ADMARP Digital Product Growth Summit 2026','ADMARP','ADMARP (Association of Digital Marketing Professionals)','Marketing. Product. Growth. Africa.','27 November 2026','157 Gardens Event Centre, Ilupeju, Lagos','https://admarp.com/digital-product-growth-summit-2026/','admarpng',NULL,'2026-11-26T23:00:00Z','2026-11-27T23:00:00Z',2),
(gen_random_uuid(),'ogun-digital-summit','Ogun Digital Summit 2026','Ogun Digital','Ogun Digital Summit','Technology, Innovation and Progress in Motion.','26 November 2026','June 12 Cultural Centre, Kuto, Abeokuta, Ogun State','https://www.ogundigitalsummit.com/',NULL,NULL,'2026-11-25T23:00:00Z','2026-11-26T23:00:00Z',3)
ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
DROP INDEX "connect"."social_posts_external_key";--> statement-breakpoint
ALTER TABLE "connect"."checkins" ADD COLUMN "event_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "connect"."checkins" ALTER COLUMN "event_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "connect"."moments" ADD COLUMN "event_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "connect"."moments" ALTER COLUMN "event_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "connect"."people" ADD COLUMN "event_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "connect"."people" ALTER COLUMN "event_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "connect"."social_posts" ADD COLUMN "event_id" uuid DEFAULT '00000000-0000-4000-8000-000000000001' NOT NULL;--> statement-breakpoint
ALTER TABLE "connect"."social_posts" ALTER COLUMN "event_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "connect"."checkins" ADD CONSTRAINT "checkins_event_id_event_spaces_id_fk" FOREIGN KEY ("event_id") REFERENCES "connect"."event_spaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connect"."moments" ADD CONSTRAINT "moments_event_id_event_spaces_id_fk" FOREIGN KEY ("event_id") REFERENCES "connect"."event_spaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connect"."people" ADD CONSTRAINT "people_event_id_event_spaces_id_fk" FOREIGN KEY ("event_id") REFERENCES "connect"."event_spaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connect"."social_posts" ADD CONSTRAINT "social_posts_event_id_event_spaces_id_fk" FOREIGN KEY ("event_id") REFERENCES "connect"."event_spaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "social_posts_event_external_key" ON "connect"."social_posts" USING btree ("event_id","external_id");--> statement-breakpoint
-- Moonshot's top accounts move to its own key (each event has its own list).
INSERT INTO "connect"."settings" ("key","value") SELECT 'top_accounts:00000000-0000-4000-8000-000000000001', "value" FROM "connect"."settings" WHERE "key" = 'top_accounts' ON CONFLICT ("key") DO NOTHING;