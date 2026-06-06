-- LOT-MEDIA-2 — visibility separation for lot + farm media.
--
--   PUBLIC_MARKET → surfaced on /api/marketplace/lots,
--                   /api/contracts/catalog and the client
--                   dashboard catalog.
--   BUYER_PRIVATE → only surfaced to a contracted buyer
--                   (future contract detail endpoint).
--   INTERNAL_ONLY → partner / ops only; never surfaced to
--                   marketplace or buyer.
--
-- Additive migration. Existing GreenLotMedia / FarmMedia
-- rows default to PUBLIC_MARKET so LOT-MEDIA-1 and
-- FARM-MEDIA-1 readiness/render behaviour is preserved.

-- CreateEnum
CREATE TYPE "LotMediaVisibility" AS ENUM (
    'PUBLIC_MARKET',
    'BUYER_PRIVATE',
    'INTERNAL_ONLY'
);

-- AlterTable: GreenLotMedia.visibility
ALTER TABLE "GreenLotMedia"
    ADD COLUMN "visibility" "LotMediaVisibility" NOT NULL DEFAULT 'PUBLIC_MARKET';

-- AlterTable: FarmMedia.visibility
ALTER TABLE "FarmMedia"
    ADD COLUMN "visibility" "LotMediaVisibility" NOT NULL DEFAULT 'PUBLIC_MARKET';

-- CreateIndex: GreenLotMedia (greenLotId, visibility)
CREATE INDEX "GreenLotMedia_greenLotId_visibility_idx"
    ON "GreenLotMedia"("greenLotId", "visibility");

-- CreateIndex: FarmMedia (farmId, visibility)
CREATE INDEX "FarmMedia_farmId_visibility_idx"
    ON "FarmMedia"("farmId", "visibility");
