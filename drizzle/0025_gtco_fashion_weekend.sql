-- GTCO Fashion Weekend 2026 (fashionweekend.gtcoplc.com): dates and logo from its site; venue as listed for 2026
-- (the GTCentre, where past editions were held). Skipped if the address already exists.
INSERT INTO "connect"."event_spaces" ("slug","name","short","organiser","tagline","dates","venue","url","starts_at","ends_at","position","brand_color","logo") VALUES
('gtco-fashion-weekend','GTCO Fashion Weekend 2026','GTCO Fashion Weekend','Guaranty Trust Holding Company (GTCO)','The latest in Nigerian and African fashion: runway, masterclasses and exhibition.','7–8 November 2026','GTCentre, Plot 1, Water Corporation Drive, Oniru, Victoria Island, Lagos','https://fashionweekend.gtcoplc.com/','2026-11-06T23:00:00Z','2026-11-08T23:00:00Z',16,'#e04000','/brands/gtco-fashion-weekend.png')
ON CONFLICT ("slug") DO NOTHING;
