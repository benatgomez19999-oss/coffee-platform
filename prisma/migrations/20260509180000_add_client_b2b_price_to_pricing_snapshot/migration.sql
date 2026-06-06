-- AlterTable
-- PRICING-B2B-3 — Persist the roasted client B2B price + audit fields.
-- All columns are nullable so existing rows remain valid; the read
-- path falls back to computeRoastedPrice(clientPricePerKg, yield)
-- when clientB2BPricePerKg is NULL.
ALTER TABLE "PricingSnapshot"
  ADD COLUMN "clientB2BPricePerKg"       DOUBLE PRECISION,
  ADD COLUMN "clientB2BPricingVersion"   TEXT,
  ADD COLUMN "clientB2BPricingMode"      TEXT,
  ADD COLUMN "clientB2BPricingBreakdown" JSONB,
  ADD COLUMN "clientB2BPriceComputedAt"  TIMESTAMP(3);
