INSERT INTO "connect"."event_spaces" ("slug","name","short","organiser","tagline","dates","venue","url","x_handle","hashtag","starts_at","ends_at","position") VALUES
('african-workforce-summit','African Workforce Summit Lagos 2026','Workforce Summit','African Workforce Summit','Slingshot. The future of work and careers in Africa.','21 November 2026','Lagos','https://selar.com/awslagos2026',NULL,NULL,'2026-11-20T23:00:00Z','2026-11-21T23:00:00Z',4)
ON CONFLICT ("slug") DO NOTHING;
