-- CreateEnum
CREATE TYPE "MarketSignalSource" AS ENUM ('MANUAL', 'API_FEED', 'INTERNAL_COMPUTE', 'AI_SYSTEM');

-- CreateTable
CREATE TABLE "MarketSignalSnapshot" (
    "id" TEXT NOT NULL,
    "cPrice" DOUBLE PRECISION NOT NULL,
    "demandIndex" DOUBLE PRECISION NOT NULL,
    "source" "MarketSignalSource" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketSignalSnapshot_pkey" PRIMARY KEY ("id")
);
