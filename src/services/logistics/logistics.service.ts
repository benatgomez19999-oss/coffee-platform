import { prisma } from "@/src/database/prisma"
import { createSamplePickup } from "./logistics.provider"

export async function requestLotSamplePickup(lotDraftId: string) {
  const lotDraft = await prisma.producerLotDraft.findUnique({
  where: { id: lotDraftId },
})

  if (!lotDraft) {
    throw new Error("Lot draft not found")
  }

  const shipment = await createSamplePickup({
    lotDraftId: lotDraft.id,
    producerId: lotDraft.producerId,
    farmId: lotDraft.farmId,
  })

  // luego aquí guardas tracking / shipment state cuando añadas columnas

  return shipment
}