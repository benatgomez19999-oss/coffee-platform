-- CreateEnum
CREATE TYPE "SampleShippingStatus" AS ENUM ('PICKUP_REQUESTED', 'PICKUP_SCHEDULED', 'IN_TRANSIT', 'DELIVERED');

-- AlterTable
ALTER TABLE "ProducerLotDraft" ADD COLUMN     "sampleShippingStatus" "SampleShippingStatus";
