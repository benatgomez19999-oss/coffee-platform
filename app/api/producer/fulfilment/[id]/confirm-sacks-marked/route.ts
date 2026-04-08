import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/src/database/prisma"
import { getUserFromRequest } from "@/src/lib/getUserFromRequest"

//////////////////////////////////////////////////////
// POST — Producer confirms all sacks are marked
//
// CONFIRMED → SACKS_MARKED_CONFIRMED
//
// [id] = ProducerFulfilment.id
//////////////////////////////////////////////////////

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    //////////////////////////////////////////////////////
    // 🔐 AUTH
    //////////////////////////////////////////////////////

    const user = await getUserFromRequest(req)

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    //////////////////////////////////////////////////////
    // 🔍 FETCH FULFILMENT + VERIFY OWNERSHIP
    //////////////////////////////////////////////////////

    const producer = await prisma.producer.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })

    if (!producer) {
      return NextResponse.json({ error: "Producer not found" }, { status: 404 })
    }

    const task = await prisma.producerFulfilment.findUnique({
      where: { id: params.id },
      select: { id: true, status: true, producerId: true },
    })

    if (!task) {
      return NextResponse.json({ error: "Fulfilment task not found" }, { status: 404 })
    }

    if (task.producerId !== producer.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    //////////////////////////////////////////////////////
    // 🛑 STATUS GUARD
    //////////////////////////////////////////////////////

    if (task.status !== "CONFIRMED") {
      return NextResponse.json(
        { error: `Cannot mark sacks for task with status ${task.status}. Expected CONFIRMED.` },
        { status: 400 }
      )
    }

    //////////////////////////////////////////////////////
    // ✅ TRANSITION CONFIRMED → SACKS_MARKED_CONFIRMED
    //////////////////////////////////////////////////////

    const updated = await prisma.producerFulfilment.update({
      where: { id: task.id },
      data: { status: "SACKS_MARKED_CONFIRMED" },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("[PRODUCER_FULFILMENT_CONFIRM_SACKS]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
