//////////////////////////////////////////////////////
// 📦 INVENTORY SERVICE
//////////////////////////////////////////////////////

import { PrismaClient } from "@prisma/client"

import { eventBus } from "../events/eventBus"
import { EVENTS } from "../events/eventTypes"
import { ProcessType } from "@prisma/client";

const prisma = new PrismaClient()

//////////////////////////////////////////////////////
// 🔔 EVENT LISTENERS
//////////////////////////////////////////////////////

eventBus.on(EVENTS.ROAST_BATCH_COMPLETED, (payload) => {

  console.log("Roast batch completed → inventory update", payload)

})

//////////////////////////////////////////////////////
// 🌱 CONVERSION LOGIC
//////////////////////////////////////////////////////

function getConversionRate(process: string): number {

  switch (process) {

    case "NATURAL":
      return 0.78

    case "HONEY":
      return 0.79

    case "WASHED":
      return 0.8

    case "ANAEROBIC":
      return 0.77

    default:
      return 0.8
  }
}

//////////////////////////////////////////////////////
// 🌱 CREATE LOT DRAFT (PRODUCER INPUT)
//////////////////////////////////////////////////////

export async function createLotDraft(input: {
  producerId: string
  farmId: string
  name?: string
  variety: string
  process: ProcessType
  harvestYear: number
  parchmentKg: number
}) {

  //////////////////////////////////////////////////////
  // 🔥 CONVERSION (SERVER SIDE ONLY)
  //////////////////////////////////////////////////////

  const conversionRate =
    getConversionRate(input.process)

  const estimatedGreenKg =
    input.parchmentKg * conversionRate

  //////////////////////////////////////////////////////
  // 💾 SAVE DRAFT
  //////////////////////////////////////////////////////

  const draft = await prisma.producerLotDraft.create({
    data: {
      producerId: input.producerId,
      farmId: input.farmId,
      name: input.name,
      variety: input.variety,
      process: input.process,
      harvestYear: input.harvestYear,

      parchmentKg: input.parchmentKg,
      estimatedGreenKg,
      conversionRate,

      status: "PENDING"
    }
  })

  return draft
}

//////////////////////////////////////////////////////
// 🔄 UPDATE DRAFT STATUS (LAB FLOW)
//////////////////////////////////////////////////////

export async function updateLotDraftStatus(
  draftId: string,
  status: "PENDING" | "SENT_TO_LAB" | "VERIFIED" | "REJECTED"
) {

  return prisma.producerLotDraft.update({
    where: { id: draftId },
    data: { status }
  })
}

//////////////////////////////////////////////////////
// 🔗 LINK VERIFIED LOT
//////////////////////////////////////////////////////

export async function linkDraftToGreenLot(
  draftId: string,
  greenLotId: string
) {

  return prisma.producerLotDraft.update({
    where: { id: draftId },
    data: {
      greenLotId,
      status: "VERIFIED"
    }
  })
}

//////////////////////////////////////////////////////
// 📦 RESERVE ROASTED BAGS (EXISTING LOGIC)
//////////////////////////////////////////////////////

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