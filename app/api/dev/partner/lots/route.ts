import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/src/database/prisma"

//////////////////////////////////////////////////////
// DEV — Partner lot states for simulation
// Returns all lots in IN_REVIEW or VERIFIED status
// with their linked greenLot (if any)
//////////////////////////////////////////////////////

export async function GET(_req: NextRequest) {
  try {
    const lots = await prisma.producerLotDraft.findMany({
      where: {
        status: { in: ["IN_REVIEW", "VERIFIED"] },
      },
      include: {
        greenLot: {
          select: {
            id: true,
            status: true,
            name: true,
            scaScore: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(lots)
  } catch (error) {
    console.error("[DEV_PARTNER_LOTS]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
