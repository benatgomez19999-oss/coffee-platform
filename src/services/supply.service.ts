import { prisma } from "@/database/prisma"

export async function getRealSupply() {

 const lots = await prisma.greenLot.findMany({
  where: {
    status: "PUBLISHED",
    availableKg: {
      gt: 0
    }
  }
})

  const totalKg = lots.reduce(
    (sum, lot) => sum + (lot.availableKg ?? 0),
    0
  )

  return {
    totalKg,
    lots
  }
}