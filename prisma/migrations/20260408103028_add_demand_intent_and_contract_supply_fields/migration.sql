-- CreateEnum
CREATE TYPE "DemandIntentType" AS ENUM ('CREATE', 'AMEND');

-- CreateEnum
CREATE TYPE "DemandIntentStatus" AS ENUM ('OPEN', 'CONSUMED', 'EXPIRED', 'REJECTED');

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "greenLotId" TEXT,
ADD COLUMN     "lockedPricePerKg" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "DemandIntent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "DemandIntentType" NOT NULL,
    "contractId" TEXT,
    "greenLotId" TEXT,
    "requestedKg" DOUBLE PRECISION NOT NULL,
    "deltaKg" DOUBLE PRECISION NOT NULL,
    "offeredKg" DOUBLE PRECISION,
    "priceLocked" BOOLEAN NOT NULL,
    "previewPricePerKg" DOUBLE PRECISION,
    "semaphore" TEXT NOT NULL,
    "riskScore" DOUBLE PRECISION NOT NULL,
    "availableAtEval" DOUBLE PRECISION NOT NULL,
    "status" "DemandIntentStatus" NOT NULL DEFAULT 'OPEN',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemandIntent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DemandIntent_companyId_idx" ON "DemandIntent"("companyId");

-- CreateIndex
CREATE INDEX "DemandIntent_greenLotId_status_idx" ON "DemandIntent"("greenLotId", "status");

-- CreateIndex
CREATE INDEX "DemandIntent_status_expiresAt_idx" ON "DemandIntent"("status", "expiresAt");

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_greenLotId_fkey" FOREIGN KEY ("greenLotId") REFERENCES "GreenLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandIntent" ADD CONSTRAINT "DemandIntent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandIntent" ADD CONSTRAINT "DemandIntent_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandIntent" ADD CONSTRAINT "DemandIntent_greenLotId_fkey" FOREIGN KEY ("greenLotId") REFERENCES "GreenLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
