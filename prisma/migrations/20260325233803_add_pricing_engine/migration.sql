/*
  Warnings:

  - Added the required column `monthlyPrice` to the `Contract` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "ContractStatus" ADD VALUE 'PAST_DUE';

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "monthlyPrice" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "stripeSubscriptionId" TEXT;

-- AlterTable
ALTER TABLE "GreenLot" ADD COLUMN     "altitude" INTEGER,
ADD COLUMN     "scaScore" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "PricingSnapshot" (
    "id" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "producerPricePerKg" DOUBLE PRECISION NOT NULL,
    "clientPricePerKg" DOUBLE PRECISION NOT NULL,
    "marginPerKg" DOUBLE PRECISION NOT NULL,
    "pricingVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PricingSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingRule" (
    "id" TEXT NOT NULL,
    "minSca" DOUBLE PRECISION,
    "maxSca" DOUBLE PRECISION,
    "minAltitude" INTEGER,
    "maxAltitude" INTEGER,
    "variety" TEXT,
    "process" "ProcessType",
    "producerPricePerKg" DOUBLE PRECISION NOT NULL,
    "clientPricePerKg" DOUBLE PRECISION NOT NULL,
    "priority" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PricingRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PricingSnapshot_lotId_key" ON "PricingSnapshot"("lotId");

-- AddForeignKey
ALTER TABLE "PricingSnapshot" ADD CONSTRAINT "PricingSnapshot_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "GreenLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
