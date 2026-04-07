import "@/src/events/server/registerEventHandlers"
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/src/database/prisma"
import { getUserFromRequest } from "@/src/lib/getUserFromRequest"
import { eventBus } from "@/src/events/core/eventBus"
import { LOGISTICS_EVENTS } from "@/src/events/logistics/logistics.events"

const SHIPPING_FLOW = [
  "PICKUP_REQUESTED",
  "PICKUP_SCHEDULED",
  "IN_TRANSIT",
  "DELIVERED",
] as const

type SampleShippingStatus = (typeof SHIPPING_FLOW)[number]

export async function POST(req: NextRequest) {
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
      return NextResponse.json(
        { error: "Producer not found" },
        { status: 404 }
      )
    }

    //////////////////////////////////////////////////////
    // 🔥 BODY
    //////////////////////////////////////////////////////

    const body = await req.json()
    const lotId = body.lotId as string | undefined
    const requestedStatus = body.nextStatus as SampleShippingStatus | undefined

    if (!lotId) {
      return NextResponse.json(
        { error: "lotId is required" },
        { status: 400 }
      )
    }

    //////////////////////////////////////////////////////
    // 🔥 GET LOT
    //////////////////////////////////////////////////////

    const lot = await prisma.producerLotDraft.findFirst({
      where: {
        id: lotId,
        producerId: producer.id,
      },
      select: {
        id: true,
        status: true,
        sampleShippingStatus: true,
      },
    })

    if (!lot) {
      return NextResponse.json(
        { error: "Lot not found" },
        { status: 404 }
      )
    }

    //////////////////////////////////////////////////////
    // 🔥 EXPLICIT STATUS / NEXT STATUS
    //////////////////////////////////////////////////////

    let nextShippingStatus: SampleShippingStatus

    if (requestedStatus) {
      nextShippingStatus = requestedStatus
    } else {
      const currentIndex = lot.sampleShippingStatus
        ? SHIPPING_FLOW.indexOf(lot.sampleShippingStatus as SampleShippingStatus)
        : -1

      if (currentIndex === -1) {
        nextShippingStatus = "PICKUP_REQUESTED"
      } else if (currentIndex >= SHIPPING_FLOW.length - 1) {
        nextShippingStatus = "DELIVERED"
      } else {
        nextShippingStatus = SHIPPING_FLOW[currentIndex + 1]
      }
    }

    //////////////////////////////////////////////////////
    // 🔥 UPDATE SHIPPING STATUS ONLY
    //////////////////////////////////////////////////////

    const updatedLot = await prisma.producerLotDraft.update({
      where: { id: lot.id },
      data: {
        sampleShippingStatus: nextShippingStatus,
      },
      select: {
        id: true,
        status: true,
        sampleShippingStatus: true,
      },
    })

    //////////////////////////////////////////////////////
    // 🔥 EMIT LOGISTICS EVENT
    //////////////////////////////////////////////////////

    if (nextShippingStatus === "DELIVERED") {
      eventBus.emit(LOGISTICS_EVENTS.SAMPLE_DELIVERED, {
        lotId: lot.id,
      })
    }

    return NextResponse.json({
      success: true,
      lot: updatedLot,
    })
  } catch (error) {
    console.error("[DEV_LOGISTICS_ADVANCE_STATUS]", error)

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}