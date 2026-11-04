-- Take the Growth & Acquisition Workshop off the site: hide it, then delete it if nothing was ever posted
-- under it (it had no Connect or Moments of its own, so normally nothing was).
UPDATE "connect"."event_spaces" SET "hidden" = true, "listed" = false, "promo" = false WHERE "slug" = 'growth-workshop';--> statement-breakpoint
DELETE FROM "connect"."event_spaces" e
WHERE e."slug" = 'growth-workshop'
  AND NOT EXISTS (SELECT 1 FROM "connect"."people" p WHERE p."event_id" = e."id")
  AND NOT EXISTS (SELECT 1 FROM "connect"."moments" m WHERE m."event_id" = e."id")
  AND NOT EXISTS (SELECT 1 FROM "connect"."checkins" c WHERE c."event_id" = e."id")
  AND NOT EXISTS (SELECT 1 FROM "connect"."social_posts" s WHERE s."event_id" = e."id");
