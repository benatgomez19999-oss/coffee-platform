-- CONTRACT-REQUEST-3 — persist the buyer's request parameters on
-- DemandIntent so the contract wizard can hydrate identically
-- whether the buyer continues immediately or returns later.
--
-- Both columns are nullable; existing intents created before
-- this migration carry NULL and the contract wizard falls back
-- to its legacy default.
--
-- Safe to roll back: dropping the columns leaves the rest of
-- the table intact.

ALTER TABLE "DemandIntent"
  ADD COLUMN "requestedDurationMonths" INTEGER,
  ADD COLUMN "requestedStartDate"      TIMESTAMP(3);
