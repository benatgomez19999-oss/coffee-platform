-- CreateTable
-- PRICING-FEED-3A — append-only audit history for provider preview ticks.
-- Recording a tick NEVER changes MarketSignalSnapshot, contracts, demand
-- intents or persisted B2B prices.
CREATE TABLE "MarketSignalTick" (
    "id"            TEXT NOT NULL,
    "providerId"    TEXT NOT NULL,
    "providerKind"  TEXT NOT NULL,
    "source"        "MarketSignalSource" NOT NULL,
    "cPrice"        DOUBLE PRECISION NOT NULL,
    "demandIndex"   DOUBLE PRECISION,
    "confidence"    TEXT,
    "rawUnit"       TEXT,
    "rawValue"      DOUBLE PRECISION,
    "symbol"        TEXT,
    "contractMonth" TEXT,
    "capturedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validFrom"     TIMESTAMP(3),
    "expiresAt"     TIMESTAMP(3),
    "sourceName"    TEXT,
    "sourceUrl"     TEXT,
    "note"          TEXT,
    "diagnostics"   JSONB,
    "rawPayload"    JSONB,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketSignalTick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketSignalTick_capturedAt_idx" ON "MarketSignalTick"("capturedAt");

-- CreateIndex
CREATE INDEX "MarketSignalTick_providerId_capturedAt_idx" ON "MarketSignalTick"("providerId", "capturedAt");

-- CreateIndex
CREATE INDEX "MarketSignalTick_source_capturedAt_idx" ON "MarketSignalTick"("source", "capturedAt");
