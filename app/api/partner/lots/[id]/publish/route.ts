import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/src/database/prisma"
import { getUserFromRequest } from "@/src/lib/getUserFromRequest"

//////////////////////////////////////////////////////
// POST — Publish a GreenLot (DRAFT → PUBLISHED)
//
// [id] = GreenLot.id
//
// The lot must already exist (created by verifyLotService)
// and must be in DRAFT status. Only then can it go live.
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

    if (user.role !== "PARTNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    //////////////////////////////////////////////////////
    // 🔍 FETCH GREEN LOT
    //////////////////////////////////////////////////////

    const greenLot = await prisma.greenLot.findUnique({
      where: { id: params.id },
      select: { id: true, status: true, name: true },
    })

    if (!greenLot) {
      return NextResponse.json({ error: "Green lot not found" }, { status: 404 })
    }

    //////////////////////////////////////////////////////
    // 🛑 STATUS GUARD
    //////////////////////////////////////////////////////

    if (greenLot.status !== "DRAFT") {
      return NextResponse.json(
        {
          error: `Cannot publish lot with status ${greenLot.status}. Expected DRAFT.`,
        },
        { status: 400 }
      )
    }

    //////////////////////////////////////////////////////
    // ✅ TRANSITION DRAFT → PUBLISHED
    //////////////////////////////////////////////////////

    const updated = await prisma.greenLot.update({
      where: { id: greenLot.id },
      data: { status: "PUBLISHED" },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("[PARTNER_LOT_PUBLISH]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
