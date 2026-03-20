// =====================================================
// IMPORTS
// =====================================================

import { PrismaClient } from "@prisma/client"
import { eventBus } from "../events/eventBus"
import { EVENTS } from "../events/eventTypes"

const prisma = new PrismaClient()

// =====================================================
// CREATE ROAST BATCH
// =====================================================
// Registra un tueste de café verde y genera el batch tostado
// También calcula automáticamente:
// - yield del tueste
// - pérdida de peso
// - número de bolsas de 20kg
// =====================================================

export async function createRoastBatch(data: {
  greenLotId: string
  roastProfileId?: string
  inputKg: number
  outputKg: number
  roastedAt: Date
}) {

  const { greenLotId, roastProfileId, inputKg, outputKg, roastedAt } = data

  // =====================================================
  // CONSTANTS
  // =====================================================

  const BAG_SIZE = 20

  // =====================================================
  // CALCULATE BAG COUNT
  // =====================================================

  const bagCount = Math.floor(outputKg / BAG_SIZE)

  // =====================================================
  // CALCULATE YIELD
  // =====================================================
  // ejemplo:
  // 120kg green → 102kg roasted
  // yield = 85%
  // loss = 15%
  // =====================================================

  const yieldPercent = (outputKg / inputKg) * 100
  const lossPercent = 100 - yieldPercent

  // =====================================================
  // CREATE ROAST BATCH
  // =====================================================

  const roastBatch = await prisma.roastBatch.create({
    data: {
      greenLotId,
      roastProfileId,
      inputKg,
      outputKg,
      yieldPercent,
      lossPercent,
      roastedAt,
    },
  })

  // =====================================================
  // CREATE ROASTED BATCH (INVENTORY)
  // =====================================================

  const roastedBatch = await prisma.roastedBatch.create({
    data: {
      roastBatchId: roastBatch.id,
      quantityKg: outputKg,
      bagSizeKg: BAG_SIZE,
      bagCount,
    },
  })

  // =====================================================
  // EMIT EVENT
  // =====================================================
  // Esto permitirá que otros servicios reaccionen:
  // - inventory
  // - analytics
  // - websocket dashboards
  // =====================================================

  eventBus.emit("roast_batch.completed", {
    roastBatchId: roastBatch.id,
    roastedBatchId: roastedBatch.id,
    bagCount,
  })

  // =====================================================
  // RETURN RESULT
  // =====================================================

  return {
    roastBatch,
    roastedBatch,
  }
}