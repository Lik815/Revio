-- CourseCategory-Seed (§20 SGB V Handlungsfelder)
-- Stellt sicher dass die Kategorien in der DB vorhanden sind, auch wenn der
-- Seed-Script nach der initialen Migration nicht ausgeführt wurde.

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
