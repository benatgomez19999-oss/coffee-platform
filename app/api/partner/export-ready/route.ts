import { prisma } from "@/database/prisma"

//////////////////////////////////////////////////////
// 🧠 EXPORT READY LOTS
//////////////////////////////////////////////////////

export async function GET() {

  //////////////////////////////////////////////////////
  // 👉 GREEN LOTS DISPONIBLES
  //////////////////////////////////////////////////////

  const lots = await prisma.greenLot.findMany({
  where: {
    status: "PUBLISHED",
    availableKg: { gt: 0 },
  },
  include: {
    producerDraft: true, // 👈 CLAVE
  },
  orderBy: {
    createdAt: "desc",
  },
})
  return Response.json(lots)
}