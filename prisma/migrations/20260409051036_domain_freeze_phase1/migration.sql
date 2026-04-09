-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DemandIntentStatus" ADD VALUE 'COUNTERED';
ALTER TYPE "DemandIntentStatus" ADD VALUE 'WAITING';
ALTER TYPE "DemandIntentStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "monthlyGreenKg" DOUBLE PRECISION,
ADD COLUMN     "roastYieldAtCreation" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "DemandIntent" ADD COLUMN     "autoExecute" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notifiedAt" TIMESTAMP(3),
ADD COLUMN     "roastYieldAtEval" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Farm" ADD COLUMN     "region" TEXT;

-- AlterTable
ALTER TABLE "GreenLot" ADD COLUMN     "estimatedRoastYield" DOUBLE PRECISION;
