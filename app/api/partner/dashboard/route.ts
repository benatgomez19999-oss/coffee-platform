export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/src/database/prisma"
import { getUserFromRequest } from "@/src/lib/getUserFromRequest"

export async function GET(req: NextRequest) {
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
    // 🧪 INCOMING
    // Sample requested — arriving at lab for analysis
    // LotDraftStatus: SAMPLE_REQUESTED
    //////////////////////////////////////////////////////

    const incoming = await prisma.producerLotDraft.findMany({
      where: {
        status: "SAMPLE_REQUESTED",
        NOT: { sampleShippingStatus: "DELIVERED" },
      },
      orderBy: { createdAt: "desc" },
    })

    //////////////////////////////////////////////////////
    // 🔬 READY TO VERIFY
    // Sample received — partner can analyse and verify
    // LotDraftStatus: IN_REVIEW
    //////////////////////////////////////////////////////

    const readyToVerify = await prisma.producerLotDraft.findMany({
      where: { status: "IN_REVIEW" },
      orderBy: { createdAt: "desc" },
    })

    //////////////////////////////////////////////////////
    // 🌿 VERIFIED
    // Approved green lots published on the marketplace
    // GreenLot status: PUBLISHED
    //////////////////////////////////////////////////////

    const verified = await prisma.greenLot.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { createdAt: "desc" },
    })

    //////////////////////////////////////////////////////
    // 📋 ORDERS / PREPARING / READY
    //
    // NOTE: Order model has no partnerId — a single partner
    // manages all lot preparation, so no partner filter exists
    // in the current schema. Returning all orders by status
    // is architecturally correct until that relation is added.
    //
    // LotCard compatibility: name + variety are flattened
    // from the first item's GreenLot via the relation chain:
    // Order → OrderItem → RoastedBatch → RoastBatch → GreenLot
    //////////////////////////////////////////////////////

    const orderInclude = {
      items: {
        include: {
          roastedBatch: {
            include: {
              roastBatch: {
                include: {
                  greenLot: true,
                },
              },
            },
          },
        },
      },
    } as const

    const flattenOrder = (order: any) => {
      const firstLot = order.items?.[0]?.roastedBatch?.roastBatch?.greenLot
      return {
        ...order,
        name: firstLot?.name ?? null,
        variety: firstLot?.variety ?? null,
      }
    }

    //////////////////////////////////////////////////////
    // 📋 ORDERS — new orders to prepare
    // OrderStatus: PENDING
    //////////////////////////////////////////////////////

    const rawOrders = await prisma.order.findMany({
      where: { status: "PENDING" },
      include: orderInclude,
      orderBy: { createdAt: "desc" },
    })

    //////////////////////////////////////////////////////
    // ⚙️ PREPARING — confirmed, being packed
    // OrderStatus: CONFIRMED
    //////////////////////////////////////////////////////

    const rawPreparing = await prisma.order.findMany({
      where: { status: "CONFIRMED" },
      include: orderInclude,
      orderBy: { createdAt: "desc" },
    })

    //////////////////////////////////////////////////////
    // ✅ READY — dispatched, awaiting pickup
    // OrderStatus: SHIPPED
    //////////////////////////////////////////////////////

    const rawReady = await prisma.order.findMany({
      where: { status: "SHIPPED" },
      include: orderInclude,
      orderBy: { createdAt: "desc" },
    })

    //////////////////////////////////////////////////////
    // ✅ RESPONSE
    //////////////////////////////////////////////////////

    return NextResponse.json({
      incoming,
      readyToVerify,
      verified,
      orders: rawOrders.map(flattenOrder),
      preparing: rawPreparing.map(flattenOrder),
      ready: rawReady.map(flattenOrder),
    })

  } catch (error) {
    console.error("PARTNER DASHBOARD ERROR:", error)

    return NextResponse.json(
      { error: "Failed to load partner dashboard" },
      { status: 500 }
    )
  }
}
