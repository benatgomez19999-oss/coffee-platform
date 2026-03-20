import { PrismaClient } from "@prisma/client"

import { eventBus } from "../events/eventBus"
import { EVENTS } from "../events/eventTypes"

eventBus.on(EVENTS.ROAST_BATCH_COMPLETED, (payload) => {

  console.log("Roast batch completed → inventory update", payload)

})

const prisma = new PrismaClient()

export async function reserveBags(
  roastedBatchId: string,
  bagsRequested: number
) {
  const batch = await prisma.roastedBatch.findUnique({
    where: { id: roastedBatchId },
  })

  if (!batch) {
    throw new Error("Roasted batch not found")
  }

  if (batch.bagCount < bagsRequested) {
    throw new Error("Not enough bags available")
  }

  return prisma.roastedBatch.update({
    where: { id: roastedBatchId },
    data: {
      bagCount: {
        decrement: bagsRequested,
      },
    },
  })
}