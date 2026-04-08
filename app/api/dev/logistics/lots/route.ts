import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/src/database/prisma"
import { getUserFromRequest } from "@/src/lib/getUserFromRequest"

export async function GET(req: NextRequest) {
  try {
    //////////////////////////////////////////////////////
    // 🔥 AUTH
    //////////////////////////////////////////////////////

    const user = await getUserFromRequest(req)

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    //////////////////////////////////////////////////////
    // 🔥 GET PRODUCER
    //////////////////////////////////////////////////////

    const producer = await prisma.producer.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })

    if (!producer) {
      return NextResponse.json([])
    }

    //////////////////////////////////////////////////////
    // 🔥 LOAD LOGISTICS LOTS
    //////////////////////////////////////////////////////

    const lots = await prisma.producerLotDraft.findMany({
      where: {
        producerId: producer.id,
        status: "SAMPLE_REQUESTED",
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        name: true,
        variety: true,
        process: true,
        status: true,
        sampleShippingStatus: true,
      },
    })

    return NextResponse.json(lots)
  } catch (error) {
    console.error("[DEV_LOGISTICS_LOTS]", error)

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}