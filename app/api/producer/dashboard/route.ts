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
        sampleRequested: [],
        inReview: [],
        verified: [],
        sold: []
      })
    }

    //////////////////////////////////////////////////////
    // 🧠 SAMPLE REQUESTED
    //////////////////////////////////////////////////////

    const sampleRequested = await prisma.producerLotDraft.findMany({
      where: {
        producerId: producer.id,
        status: "SAMPLE_REQUESTED"
      },
      orderBy: { createdAt: "desc" }
    })

    //////////////////////////////////////////////////////
    // 🧠 UNDER REVIEW
    //////////////////////////////////////////////////////

    const inReview = await prisma.producerLotDraft.findMany({
      where: {
        producerId: producer.id,
        status: "IN_REVIEW"
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
    // 📦 PRODUCER FULFILMENT TASKS
    // Active tasks only — COURIER_VERIFIED is terminal,
    // excluded so the task disappears after courier signs off.
    //////////////////////////////////////////////////////

    const fulfilmentTasks = await prisma.producerFulfilment.findMany({
      where: {
        producerId: producer.id,
        status: { not: "COURIER_VERIFIED" },
      },
      include: {
        greenLot: {
          select: {
            id: true,
            name: true,
            lotNumber: true,
            variety: true,
            process: true,
          },
        },
        order: {
          select: { id: true, createdAt: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    //////////////////////////////////////////////////////
    // ✅ RESPONSE
    //////////////////////////////////////////////////////

    return NextResponse.json({
      sampleRequested,
      inReview,
      verified,
      sold,
      fulfilmentTasks,
    })

  } catch (error) {
    console.error("DASHBOARD ERROR:", error)

    return NextResponse.json(
      { error: "Failed to load dashboard" },
      { status: 500 }
    )
  }
}