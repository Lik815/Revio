-- Idempotentes Seed für CourseCategory. Läuft bei jedem Server-Start (start.sh),
-- weil "prisma db push" (Produktion) keine SQL aus prisma/migrations ausführt.
INSERT INTO "CourseCategory" ("id", "key", "label", "sortOrder", "isActive", "createdAt")
VALUES
  (gen_random_uuid()::text, 'bewegung',    'Bewegungsgesundheit', 1, true, NOW()),
  (gen_random_uuid()::text, 'ernaehrung',  'Ernährung',           2, true, NOW()),
  (gen_random_uuid()::text, 'stress',      'Stressbewältigung',   3, true, NOW()),
  (gen_random_uuid()::text, 'entspannung', 'Entspannung',         4, true, NOW()),
  (gen_random_uuid()::text, 'sucht',       'Suchtmittelkonsum',   5, true, NOW()),
  (gen_random_uuid()::text, 'sonstiges',   'Sonstiges',           6, true, NOW())
ON CONFLICT ("key") DO UPDATE SET
  "label"     = EXCLUDED."label",
  "sortOrder" = EXCLUDED."sortOrder",
  "isActive"  = EXCLUDED."isActive";
