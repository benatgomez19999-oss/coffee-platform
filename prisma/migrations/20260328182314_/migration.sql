/*
  Warnings:

  - You are about to drop the column `quantityKg` on the `GreenLot` table. All the data in the column will be lost.
  - Added the required column `availableKg` to the `GreenLot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pricePerKg` to the `GreenLot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalKg` to the `GreenLot` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "LotStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RESERVED', 'SOLD');

-- AlterTable
ALTER TABLE "GreenLot" DROP COLUMN "quantityKg",
ADD COLUMN     "availableKg" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'EUR',
ADD COLUMN     "description" TEXT,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "pricePerKg" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "status" "LotStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "totalKg" DOUBLE PRECISION NOT NULL;

-- AlterTable
ALTER TABLE "PricingSnapshot" ADD COLUMN     "breakdown" JSONB,
ADD COLUMN     "context" JSONB;
