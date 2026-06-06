-- CreateEnum
-- LOT-MEDIA-1 — semantic ordered media for green lots.
-- Each row carries a role (FARM / PROCESS / …) so the ordered sequence
-- forms a documentary narrative rather than an opaque string[] array.
CREATE TYPE "LotMediaRole" AS ENUM (
    'FARM',
    'PROCESS',
    'PRODUCER',
    'TRACEABILITY_BAG',
    'PRODUCT_DETAIL',
    'CERTIFICATE',
    'EDITORIAL_FALLBACK'
);

-- CreateEnum
-- Source trust model:
--   PARTNER_UPLOAD / PLATFORM_CURATED  → verified documentary evidence
--   GENERATED_EDITORIAL / TONAL_PLACEHOLDER → fallback/illustrative
CREATE TYPE "LotMediaSource" AS ENUM (
    'PARTNER_UPLOAD',
    'PLATFORM_CURATED',
    'GENERATED_EDITORIAL',
    'TONAL_PLACEHOLDER'
);

-- CreateTable
CREATE TABLE "GreenLotMedia" (
    "id"         TEXT NOT NULL,
    "greenLotId" TEXT NOT NULL,
    "url"        TEXT NOT NULL,
    "role"       "LotMediaRole" NOT NULL,
    "source"     "LotMediaSource" NOT NULL,
    "position"   INTEGER NOT NULL DEFAULT 0,
    "isPrimary"  BOOLEAN NOT NULL DEFAULT false,
    "altText"    TEXT,
    "caption"    TEXT,
    "credit"     TEXT,
    "metadata"   JSONB,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GreenLotMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GreenLotMedia_greenLotId_idx" ON "GreenLotMedia"("greenLotId");

-- CreateIndex
CREATE INDEX "GreenLotMedia_greenLotId_role_idx" ON "GreenLotMedia"("greenLotId", "role");

-- CreateIndex
CREATE INDEX "GreenLotMedia_greenLotId_isPrimary_idx" ON "GreenLotMedia"("greenLotId", "isPrimary");

-- AddForeignKey
ALTER TABLE "GreenLotMedia"
    ADD CONSTRAINT "GreenLotMedia_greenLotId_fkey"
    FOREIGN KEY ("greenLotId") REFERENCES "GreenLot"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
