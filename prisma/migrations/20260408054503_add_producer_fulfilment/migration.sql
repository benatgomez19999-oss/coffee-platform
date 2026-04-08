-- CreateEnum
CREATE TYPE "ProducerFulfilmentStatus" AS ENUM ('AWAITING_CONFIRMATION', 'CONFIRMED', 'SACKS_MARKED_CONFIRMED', 'COURIER_VERIFIED');

-- CreateTable
CREATE TABLE "ProducerFulfilment" (
    "id" TEXT NOT NULL,
    "greenLotId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "producerId" TEXT NOT NULL,
    "status" "ProducerFulfilmentStatus" NOT NULL DEFAULT 'AWAITING_CONFIRMATION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProducerFulfilment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProducerFulfilment_greenLotId_key" ON "ProducerFulfilment"("greenLotId");

-- AddForeignKey
ALTER TABLE "ProducerFulfilment" ADD CONSTRAINT "ProducerFulfilment_greenLotId_fkey" FOREIGN KEY ("greenLotId") REFERENCES "GreenLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProducerFulfilment" ADD CONSTRAINT "ProducerFulfilment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProducerFulfilment" ADD CONSTRAINT "ProducerFulfilment_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "Producer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
