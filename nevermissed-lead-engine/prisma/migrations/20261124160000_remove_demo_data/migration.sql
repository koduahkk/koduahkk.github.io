-- One-time cleanup: remove the demo data loaded by prisma/seed.ts.
-- Demo rows are identified by markers real data never has:
--   * demo salons' websites end in ".example" (a reserved domain)
--   * demo phones are in the reserved 555-0100..0199 range, demo emails end in ".example"
-- Calls, scores, emails, enrollments, contacts and tasks are removed with their salon
-- (ON DELETE CASCADE). Demo sign-in users are kept: demo mode needs them to sign in.

DELETE FROM "Lead" WHERE "website" LIKE 'https://%.example';

DELETE FROM "Suppression"
WHERE ("kind" = 'EMAIL' AND "value" LIKE '%.example')
   OR ("kind" = 'PHONE' AND "value" ~ '^\+1[0-9]{3}55501[0-9]{2}$');

DELETE FROM "SenderIdentity" WHERE "email" LIKE '%.example';

-- Demo territories, only if nothing uses them: no salons and never searched.
DELETE FROM "Territory" t
WHERE t."name" IN ('Atlanta metro', 'Austin metro', 'Denver metro', 'Atlanta, GA', 'Austin, TX', 'Denver, CO')
  AND t."sourcingCursor" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "Lead" l WHERE l."territoryId" = t."id");

-- Clear the priority territory if it pointed at a removed one.
UPDATE "Settings"
SET "general" = jsonb_set("general", '{priorityTerritoryId}', 'null'::jsonb)
WHERE "general"->>'priorityTerritoryId' IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Territory" t WHERE t."id" = "general"->>'priorityTerritoryId');
