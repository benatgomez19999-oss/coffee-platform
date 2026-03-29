-- CreateEnum
CREATE TYPE "LotDraftStatus" AS ENUM ('PENDING', 'SENT_TO_LAB', 'VERIFIED', 'REJECTED');

-- CreateTable
CREATE TABLE "ProducerLotDraft" (
    "id" TEXT NOT NULL,
    "producerId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT,
    "variety" TEXT NOT NULL,
    "process" "ProcessType" NOT NULL,
    "harvestYear" INTEGER NOT NULL,
    "parchmentKg" DOUBLE PRECISION NOT NULL,
    "estimatedGreenKg" DOUBLE PRECISION NOT NULL,
    "conversionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "status" "LotDraftStatus" NOT NULL DEFAULT 'PENDING',
    "greenLotId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProducerLotDraft_pkey" PRIMARY KEY ("id")
);
