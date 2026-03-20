import { PrismaClient } from "@prisma/client"
import { eventBus } from "../events/eventBus"

const prisma = new PrismaClient()

export async function createRoastBatch(data: {
  greenLotId: string
  roastProfileId?: string
  inputKg: number
  outputKg: number
  roastedAt: Date
}) {

  const { greenLotId, roastProfileId, inputKg, outputKg, roastedAt } = data

  const BAG_SIZE = 20

  const bagCount = Math.floor(outputKg / BAG_SIZE)

  const yieldPercent = (outputKg / inputKg) * 100
  const lossPercent = 100 - yieldPercent

  const roastBatch = await prisma.roastBatch.create({
    data: {
      greenLotId,
      roastProfileId,
      inputKg,
      outputKg,
      yieldPercent,
      lossPercent,
      roastedAt
    }
  })

  const roastedBatch = await prisma.roastedBatch.create({
    data: {
      roastBatchId: roastBatch.id,
      quantityKg: outputKg,
      bagSizeKg: BAG_SIZE,
      bagCount
    }
  })

  eventBus.emit("roast_batch.completed", {
    roastBatchId: roastBatch.id,
    roastedBatchId: roastedBatch.id,
    bagCount
  })

  return {
    roastBatch,
    roastedBatch
  }
}