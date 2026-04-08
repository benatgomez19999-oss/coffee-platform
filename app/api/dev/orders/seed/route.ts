import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/src/database/prisma"

//////////////////////////////////////////////////////
// DEV BRIDGE — Seed a fake Order in PENDING status
//
// Prerequisites:
//   1. A RoastedBatch must exist (requires the full lab
//      flow: verify → GreenLot → RoastBatch → RoastedBatch)
//   2. A Company must exist (buyer entity)
//
// This route is dev-only. It will never ship to production.
//////////////////////////////////////////////////////

export async function POST(_req: NextRequest) {
  try {
    //////////////////////////////////////////////////////
    // 1. FIND A ROASTED BATCH
    //////////////////////////////////////////////////////

    const roastedBatch = await prisma.roastedBatch.findFirst({
      orderBy: { createdAt: "desc" },
      select: { id: true },
    })

    if (!roastedBatch) {
      return NextResponse.json(
        {
          error: "No RoastedBatch found. Run the full lab flow first: verify a lot → it creates a GreenLot. Then a RoastBatch and RoastedBatch must be created against that GreenLot before an order can be seeded.",
        },
        { status: 422 }
      )
    }

    //////////////////////////////////////////////////////
    // 2. FIND A COMPANY
    //////////////////////////////////////////////////////

    const company = await prisma.company.findFirst({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true },
    })

    if (!company) {
      return NextResponse.json(
        {
          error: "No Company found. A Company (buyer) must exist in the database before an order can be seeded.",
        },
        { status: 422 }
      )
    }

    //////////////////////////////////////////////////////
    // 3. CREATE ORDER + ORDER ITEM
    //////////////////////////////////////////////////////

    const order = await prisma.order.create({
      data: {
        companyId: company.id,
        status: "PENDING",
        items: {
          create: {
            roastedBatchId: roastedBatch.id,
            bags: 1,
            pricePerBag: 1.0,
          },
        },
      },
      include: {
        items: true,
      },
    })

    return NextResponse.json({
      success: true,
      order,
      _meta: {
        company: company.name,
        roastedBatchId: roastedBatch.id,
        note: "pricePerBag is a neutral placeholder (1.0). No real pricing applied.",
      },
    })
  } catch (error) {
    console.error("[DEV_ORDER_SEED]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
