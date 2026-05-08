import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/src/database/prisma"
import { requireDevRoute } from "@/src/lib/dev/requireDevRoute"

//////////////////////////////////////////////////////
// DEV BRIDGE — Force LotDraftStatus transition
// Use to move a lot into IN_REVIEW without going
// through the full shipping simulation.
// No equivalent real route exists.
//////////////////////////////////////////////////////

const VALID_LOT_DRAFT_STATUSES = [
  "PENDING",
  "SAMPLE_REQUESTED",
  "IN_REVIEW",
  "VERIFIED",
  "REJECTED",
] as const

type LotDraftStatusValue = (typeof VALID_LOT_DRAFT_STATUSES)[number]

export async function POST(req: NextRequest) {
  try {
    //////////////////////////////////////////////////////
    // 🔐 DEV-ONLY GUARD
    //////////////////////////////////////////////////////

    const guard = await requireDevRoute()
    if (!guard.ok) return guard.response

    const { lotId, status } = await req.json()

    if (!lotId || !status) {
      return NextResponse.json(
        { error: "lotId and status are required" },
        { status: 400 }
      )
    }

    //////////////////////////////////////////////////////
    // 🛡️ ENUM VALIDATION
    //////////////////////////////////////////////////////

    if (!VALID_LOT_DRAFT_STATUSES.includes(status as LotDraftStatusValue)) {
      return NextResponse.json(
        { error: "Invalid lot draft status" },
        { status: 400 }
      )
    }

    const updated = await prisma.producerLotDraft.update({
      where: { id: lotId },
      data: { status: status as LotDraftStatusValue },
      select: { id: true, status: true },
    })

    return NextResponse.json({ success: true, lot: updated })
  } catch (error) {
    console.error("[DEV_PARTNER_SET_LOT_STATUS]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
