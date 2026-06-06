-- FARM-MEDIA-1 — reusable farm-level media table.
-- Same role/source enums as GreenLotMedia so the inherited
-- sequence shares a single role priority + trust model.
-- Additive, no backfill required.

-- CreateTable
CREATE TABLE "FarmMedia" (
    "id"        TEXT NOT NULL,
    "farmId"    TEXT NOT NULL,
    "url"       TEXT NOT NULL,
    "role"      "LotMediaRole" NOT NULL,
    "source"    "LotMediaSource" NOT NULL,
    "position"  INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "altText"   TEXT,
    "caption"   TEXT,
    "credit"    TEXT,
    "metadata"  JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FarmMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FarmMedia_farmId_idx" ON "FarmMedia"("farmId");

-- CreateIndex
CREATE INDEX "FarmMedia_farmId_role_idx" ON "FarmMedia"("farmId", "role");

-- CreateIndex
CREATE INDEX "FarmMedia_farmId_isPrimary_idx" ON "FarmMedia"("farmId", "isPrimary");

-- AddForeignKey
ALTER TABLE "FarmMedia"
    ADD CONSTRAINT "FarmMedia_farmId_fkey"
    FOREIGN KEY ("farmId") REFERENCES "Farm"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
