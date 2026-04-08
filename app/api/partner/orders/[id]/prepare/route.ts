import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/src/database/prisma"
import { getUserFromRequest } from "@/src/lib/getUserFromRequest"
import { sendSMS } from "@/src/lib/sendSMS"

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

    if (user.role !== "PARTNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    //////////////////////////////////////////////////////
    // 🔍 FETCH ORDER WITH FULL GREEN LOT CHAIN
    //
    // We need: Order → items → roastedBatch → roastBatch
    //          → greenLot → farm { producerId, producer.user.phone }
    //////////////////////////////////////////////////////

    const order = await prisma.order.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        status: true,
        items: {
          select: {
            roastedBatch: {
              select: {
                roastBatch: {
                  select: {
                    greenLot: {
                      select: {
                        id: true,
                        name: true,
                        lotNumber: true,
                        farm: {
                          select: {
                            producerId: true,
                            producer: {
                              select: {
                                id: true,
                                user: {
                                  select: { phone: true },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    //////////////////////////////////////////////////////
    // 🛑 STATUS GUARD
    //////////////////////////////////////////////////////

    if (order.status !== "PENDING") {
      return NextResponse.json(
        { error: `Cannot prepare order with status ${order.status}. Expected PENDING.` },
        { status: 400 }
      )
    }

    //////////////////////////////////////////////////////
    // ✅ TRANSITION PENDING → CONFIRMED
    //////////////////////////////////////////////////////

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { status: "CONFIRMED" },
    })

    //////////////////////////////////////////////////////
    // 📦 CREATE PRODUCER FULFILMENT TASKS
    //
    // One ProducerFulfilment per unique GreenLot in the order.
    // Uses upsert to remain idempotent if re-triggered.
    //////////////////////////////////////////////////////

    const seenGreenLotIds = new Set<string>()

    for (const item of order.items) {
      const greenLot = item.roastedBatch?.roastBatch?.greenLot
      if (!greenLot || seenGreenLotIds.has(greenLot.id)) continue
      seenGreenLotIds.add(greenLot.id)

      const producerId = greenLot.farm.producerId
      const phone = greenLot.farm.producer?.user?.phone
      const lotCode = greenLot.lotNumber
      const lotName = greenLot.name || lotCode

      await prisma.producerFulfilment.upsert({
        where: { greenLotId: greenLot.id },
        create: {
          greenLotId: greenLot.id,
          orderId: order.id,
          producerId,
          status: "AWAITING_CONFIRMATION",
        },
        update: {}, // already exists — don't overwrite status
      })

      await sendSMS(
        phone,
        `New fulfilment task: Lot "${lotName}" (${lotCode}). Mark all sacks with code ${lotCode} and confirm in your dashboard.`
      )
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error("[PARTNER_ORDER_PREPARE]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
