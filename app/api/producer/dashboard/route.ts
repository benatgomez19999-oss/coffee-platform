export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { prisma } from "@/src/database/prisma"
import { getUserFromRequest } from "@/src/lib/getUserFromRequest"
import { NextRequest } from "next/server"

export async function GET(req: NextRequest) {
  try {
    //////////////////////////////////////////////////////
    // 🔐 AUTH
    //////////////////////////////////////////////////////

    const user = await getUserFromRequest(req)

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    //////////////////////////////////////////////////////
    // 🧠 GET PRODUCER
    //////////////////////////////////////////////////////

    const producer = await prisma.producer.findUnique({
      where: { userId: user.id }
    })

    if (!producer) {
      return NextResponse.json({
        drafts: [],
        inLab: [],
        verified: [],
        sold: []
      })
    }

    //////////////////////////////////////////////////////
    // 🧠 DRAFTS
    //////////////////////////////////////////////////////

    const drafts = await prisma.producerLotDraft.findMany({
      where: {
        producerId: producer.id,
        status: "PENDING"
      },
      orderBy: { createdAt: "desc" }
    })

    //////////////////////////////////////////////////////
    // 🧠 IN LAB
    //////////////////////////////////////////////////////

    const inLab = await prisma.producerLotDraft.findMany({
      where: {
        producerId: producer.id,
        status: "SENT_TO_LAB"
      },
      orderBy: { createdAt: "desc" }
    })

    //////////////////////////////////////////////////////
    // 🧠 GREEN LOTS (via FARM)
    //////////////////////////////////////////////////////

    const greenLots = await prisma.greenLot.findMany({
      where: {
        farm: {
          producerId: producer.id
        }
      },
      orderBy: { createdAt: "desc" }
    })

    //////////////////////////////////////////////////////
    // 🧠 SPLIT STATUS
    //////////////////////////////////////////////////////

    const verified = greenLots.filter(l => l.status === "PUBLISHED")
    const sold = greenLots.filter(l => l.status === "SOLD")

    //////////////////////////////////////////////////////
    // ✅ RESPONSE
    //////////////////////////////////////////////////////

    return NextResponse.json({
      drafts,
      inLab,
      verified,
      sold
    })

  } catch (error) {
    console.error("DASHBOARD ERROR:", error)

    return NextResponse.json(
      { error: "Failed to load dashboard" },
      { status: 500 }
    )
  }
}