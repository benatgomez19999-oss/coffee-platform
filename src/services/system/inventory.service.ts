// =====================================================
// INVENTORY SERVICE
//
// Gestión de stock físico:
// =====================================================

import { prisma } from "@/src/database/prisma"

// =====================================================
// RESERVE ROASTED BAGS
// =====================================================

export async function reserveBags(
  roastedBatchId: string,
  bagsRequested: number
) {

  //////////////////////////////////////////////////////
  // FETCH BATCH
  //////////////////////////////////////////////////////

  const batch = await prisma.roastedBatch.findUnique({
    where: { id: roastedBatchId },
  })

  if (!batch) {
    throw new Error("Roasted batch not found")
  }

  //////////////////////////////////////////////////////
  // VALIDATION
  //////////////////////////////////////////////////////

  if (batch.bagCount < bagsRequested) {
    throw new Error("Not enough bags available")
  }

  //////////////////////////////////////////////////////
  // UPDATE
  //////////////////////////////////////////////////////

  return prisma.roastedBatch.update({
    where: { id: roastedBatchId },
    data: {
      bagCount: {
        decrement: bagsRequested,
      },
    },
  })
}