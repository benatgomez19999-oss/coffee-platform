-- CreateEnum
CREATE TYPE "HealthSeverity" AS ENUM ('OK', 'WATCH', 'STRESSED', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('IN_TRANSIT', 'ARRIVED', 'RECEIVED', 'DISCREPANCY');

-- AlterTable
ALTER TABLE "GreenLot" ADD COLUMN     "shipmentId" TEXT;

-- CreateTable
CREATE TABLE "CommitmentHealthSnapshot" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "monitorVersion" TEXT NOT NULL,
    "runStartedAt" TIMESTAMP(3) NOT NULL,
    "runFinishedAt" TIMESTAMP(3) NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "inputFingerprint" TEXT NOT NULL,
    "overallHealth" "HealthSeverity" NOT NULL,
    "supplyHealth" "HealthSeverity" NOT NULL,
    "demandHealth" "HealthSeverity" NOT NULL,
    "commitmentHealth" "HealthSeverity" NOT NULL,
    "fulfilmentHealth" "HealthSeverity" NOT NULL,
    "metrics" JSONB NOT NULL,
    "detectors" JSONB NOT NULL,
    "attribution" JSONB NOT NULL,
    "inputCounts" JSONB NOT NULL,
    "triggeredBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommitmentHealthSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'IN_TRANSIT',
    "carrier" TEXT,
    "vesselOrFlight" TEXT,
    "etaAt" TIMESTAMP(3),
    "arrivedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommitmentHealthSnapshot_runId_key" ON "CommitmentHealthSnapshot"("runId");

-- CreateIndex
CREATE INDEX "CommitmentHealthSnapshot_runStartedAt_idx" ON "CommitmentHealthSnapshot"("runStartedAt");

-- CreateIndex
CREATE INDEX "CommitmentHealthSnapshot_overallHealth_idx" ON "CommitmentHealthSnapshot"("overallHealth");

-- CreateIndex
CREATE INDEX "CommitmentHealthSnapshot_inputFingerprint_idx" ON "CommitmentHealthSnapshot"("inputFingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_reference_key" ON "Shipment"("reference");

-- CreateIndex
CREATE INDEX "Shipment_status_idx" ON "Shipment"("status");

-- CreateIndex
CREATE INDEX "Shipment_createdAt_idx" ON "Shipment"("createdAt");

-- CreateIndex
CREATE INDEX "GreenLot_shipmentId_idx" ON "GreenLot"("shipmentId");

-- AddForeignKey
ALTER TABLE "GreenLot" ADD CONSTRAINT "GreenLot_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
