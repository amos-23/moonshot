ALTER TABLE "connect"."event_spaces" ADD COLUMN "logo" text;--> statement-breakpoint
ALTER TABLE "connect"."event_spaces" ADD COLUMN "logo_bg" text;--> statement-breakpoint
-- Each event's own logo and colours, taken from its official site (or ticket page).
UPDATE "connect"."event_spaces" SET "logo" = '/brands/afriff-film-market.webp', "logo_bg" = '#1b2a52' WHERE "slug" = 'afriff-film-market';--> statement-breakpoint
UPDATE "connect"."event_spaces" SET "logo" = '/brands/national-advertising-conference.png' WHERE "slug" = 'national-advertising-conference';--> statement-breakpoint
UPDATE "connect"."event_spaces" SET "logo" = '/brands/neclive.png' WHERE "slug" = 'neclive';--> statement-breakpoint
UPDATE "connect"."event_spaces" SET "logo" = '/brands/devfest-lagos.svg' WHERE "slug" = 'devfest-lagos';--> statement-breakpoint
UPDATE "connect"."event_spaces" SET "logo" = '/brands/entertainment-week-africa.png', "logo_bg" = '#0a0510' WHERE "slug" = 'entertainment-week-africa';--> statement-breakpoint
UPDATE "connect"."event_spaces" SET "logo" = '/brands/growth-africa-summit.png' WHERE "slug" = 'growth-africa-summit';--> statement-breakpoint
UPDATE "connect"."event_spaces" SET "logo" = '/brands/african-workforce-summit.png', "brand_color" = COALESCE("brand_color", '#23236b') WHERE "slug" = 'african-workforce-summit';
