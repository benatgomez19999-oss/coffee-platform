import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/src/database/prisma"

//////////////////////////////////////////////////////
// DEV BRIDGE — Force LotDraftStatus transition
// Use to move a lot into IN_REVIEW without going
// through the full shipping simulation.
// No equivalent real route exists.
//////////////////////////////////////////////////////

export async function POST(req: NextRequest) {
  try {
    const { lotId, status } = await req.json()

    if (!lotId || !status) {
      return NextResponse.json(
        { error: "lotId and status are required" },
        { status: 400 }
      )
    }

    const updated = await prisma.producerLotDraft.update({
      where: { id: lotId },
      data: { status },
      select: { id: true, status: true },
    })

    return NextResponse.json({ success: true, lot: updated })
  } catch (error) {
    console.error("[DEV_PARTNER_SET_LOT_STATUS]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
