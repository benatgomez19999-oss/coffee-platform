import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/src/database/prisma"
import { getUserFromRequest } from "@/src/lib/getUserFromRequest"

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
    // 🔍 FETCH ORDER
    //////////////////////////////////////////////////////

    const order = await prisma.order.findUnique({
      where: { id: params.id },
      select: { id: true, status: true },
    })

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    //////////////////////////////////////////////////////
    // 🛑 STATUS GUARD
    //////////////////////////////////////////////////////

    if (order.status !== "CONFIRMED") {
      return NextResponse.json(
        { error: `Cannot mark order ready with status ${order.status}. Expected CONFIRMED.` },
        { status: 400 }
      )
    }

    //////////////////////////////////////////////////////
    // ✅ TRANSITION CONFIRMED → SHIPPED
    //////////////////////////////////////////////////////

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { status: "SHIPPED" },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("[PARTNER_ORDER_READY]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
