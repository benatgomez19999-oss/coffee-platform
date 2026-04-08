import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/src/database/prisma"

//////////////////////////////////////////////////////
// DEV BRIDGE — Publish a GreenLot (DRAFT → PUBLISHED)
// No real partner route exists for this transition yet.
// The verify service creates GreenLots in DRAFT status;
// this bridge simulates the publish step.
//////////////////////////////////////////////////////

export async function POST(req: NextRequest) {
  try {
    const { greenLotId } = await req.json()

    if (!greenLotId) {
      return NextResponse.json(
        { error: "greenLotId is required" },
        { status: 400 }
      )
    }

    const updated = await prisma.greenLot.update({
      where: { id: greenLotId },
      data: { status: "PUBLISHED" },
      select: { id: true, status: true, name: true },
    })

    return NextResponse.json({ success: true, greenLot: updated })
  } catch (error) {
    console.error("[DEV_PARTNER_PUBLISH_GREEN_LOT]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
