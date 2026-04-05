/*
  Warnings:

  - A unique constraint covering the columns `[lotNumber]` on the table `GreenLot` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId]` on the table `Producer` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[lotNumber]` on the table `ProducerLotDraft` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[greenLotId]` on the table `ProducerLotDraft` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `lotNumber` to the `GreenLot` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Producer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lotNumber` to the `ProducerLotDraft` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "StorySource" AS ENUM ('AI', 'MANUAL');

-- CreateEnum
CREATE TYPE "StoryStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- AlterTable
ALTER TABLE "GreenLot" ADD COLUMN     "lotNumber" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Producer" ADD COLUMN     "userId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ProducerLotDraft" ADD COLUMN     "lotNumber" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "FarmStory" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source" "StorySource" NOT NULL DEFAULT 'AI',
    "status" "StoryStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FarmStory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GreenLot_lotNumber_key" ON "GreenLot"("lotNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Producer_userId_key" ON "Producer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProducerLotDraft_lotNumber_key" ON "ProducerLotDraft"("lotNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ProducerLotDraft_greenLotId_key" ON "ProducerLotDraft"("greenLotId");

-- AddForeignKey
ALTER TABLE "Producer" ADD CONSTRAINT "Producer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProducerLotDraft" ADD CONSTRAINT "ProducerLotDraft_greenLotId_fkey" FOREIGN KEY ("greenLotId") REFERENCES "GreenLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmStory" ADD CONSTRAINT "FarmStory_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
