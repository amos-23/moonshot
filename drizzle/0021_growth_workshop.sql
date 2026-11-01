ALTER TABLE "connect"."event_spaces" ADD COLUMN "promo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Growth & Acquisition Workshop (growthworkshop.xyz): a featured banner, first on the homepage, until it ends.
INSERT INTO "connect"."event_spaces" ("slug","name","short","organiser","tagline","dates","venue","url","starts_at","ends_at","position","brand_color","logo","promo") VALUES
('growth-workshop','Growth & Acquisition Workshop','G&A Workshop','Amos Feranmi','If your marketing isn''t driving revenue, what exactly is it driving?','Saturday, 7 November 2026 · 12 PM WAT','Live virtual workshop','https://www.growthworkshop.xyz/','2026-11-07T11:00:00Z','2026-11-07T23:00:00Z',0,'#ffd84d','/brands/growth-workshop.svg',true)
ON CONFLICT ("slug") DO NOTHING;
