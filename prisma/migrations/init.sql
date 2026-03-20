-- CreateEnum
CREATE TYPE "ProcessType" AS ENUM ('WASHED', 'NATURAL', 'HONEY', 'ANAEROBIC');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED');

-- CreateTable
CREATE TABLE "Producer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Producer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Farm" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "altitude" INTEGER,
    "producerId" TEXT NOT NULL,

    CONSTRAINT "Farm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GreenLot" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "variety" TEXT NOT NULL,
    "process" "ProcessType" NOT NULL,
    "harvestYear" INTEGER NOT NULL,
    "quantityKg" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GreenLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "quantityKg" DOUBLE PRECISION NOT NULL,
    "pricePerKg" DOUBLE PRECISION NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoastProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "RoastProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoastBatch" (
    "id" TEXT NOT NULL,
    "greenLotId" TEXT NOT NULL,
    "roastProfileId" TEXT,
    "inputKg" DOUBLE PRECISION NOT NULL,
    "outputKg" DOUBLE PRECISION NOT NULL,
    "yieldPercent" DOUBLE PRECISION,
    "lossPercent" DOUBLE PRECISION,
    "roastedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoastBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoastedBatch" (
    "id" TEXT NOT NULL,
    "roastBatchId" TEXT NOT NULL,
    "quantityKg" DOUBLE PRECISION NOT NULL,
    "bagSizeKg" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "bagCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoastedBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "roastedBatchId" TEXT,
    "bagsPerDelivery" INTEGER NOT NULL,
    "pricePerBag" DOUBLE PRECISION NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contractId" TEXT,
    "status" "OrderStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "roastedBatchId" TEXT NOT NULL,
    "bags" INTEGER NOT NULL,
    "pricePerBag" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoastedBatch_roastBatchId_key" ON "RoastedBatch"("roastBatchId");

-- AddForeignKey
ALTER TABLE "Farm" ADD CONSTRAINT "Farm_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "Producer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GreenLot" ADD CONSTRAINT "GreenLot_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "GreenLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoastBatch" ADD CONSTRAINT "RoastBatch_greenLotId_fkey" FOREIGN KEY ("greenLotId") REFERENCES "GreenLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoastBatch" ADD CONSTRAINT "RoastBatch_roastProfileId_fkey" FOREIGN KEY ("roastProfileId") REFERENCES "RoastProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoastedBatch" ADD CONSTRAINT "RoastedBatch_roastBatchId_fkey" FOREIGN KEY ("roastBatchId") REFERENCES "RoastBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_roastedBatchId_fkey" FOREIGN KEY ("roastedBatchId") REFERENCES "RoastedBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_roastedBatchId_fkey" FOREIGN KEY ("roastedBatchId") REFERENCES "RoastedBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

