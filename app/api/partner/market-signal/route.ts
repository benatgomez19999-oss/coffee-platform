import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/src/database/prisma"
import { getUserFromRequest } from "@/src/lib/getUserFromRequest"

const VALID_SOURCES = ["MANUAL", "API_FEED", "INTERNAL_COMPUTE", "AI_SYSTEM"] as const

//////////////////////////////////////////////////////
// GET — Return the current active MarketSignalSnapshot
//////////////////////////////////////////////////////

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (user.role !== "PARTNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const snapshot = await prisma.marketSignalSnapshot.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(snapshot ?? null)
  } catch (error) {
    console.error("[MARKET_SIGNAL_GET]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

//////////////////////////////////////////////////////
// POST — Create a new active MarketSignalSnapshot
//
// Deactivates all currently active snapshots and
// creates the new one in a single transaction.
//////////////////////////////////////////////////////

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (user.role !== "PARTNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const { cPrice, demandIndex, source, note, expiresAt } = body

    //////////////////////////////////////////////////////
    // VALIDATE cPrice
    //////////////////////////////////////////////////////

    if (typeof cPrice !== "number" || !Number.isFinite(cPrice) || cPrice < 50 || cPrice > 600) {
      return NextResponse.json(
        { error: "cPrice must be a finite number between 50 and 600 (cents/lb)" },
        { status: 400 }
      )
    }

    //////////////////////////////////////////////////////
    // VALIDATE demandIndex
    //////////////////////////////////////////////////////

    if (
      typeof demandIndex !== "number" ||
      !Number.isFinite(demandIndex) ||
      demandIndex < 0.8 ||
      demandIndex > 1.2
    ) {
      return NextResponse.json(
        { error: "demandIndex must be a finite number between 0.8 and 1.2" },
        { status: 400 }
      )
    }

    //////////////////////////////////////////////////////
    // VALIDATE source
    //////////////////////////////////////////////////////

    if (!VALID_SOURCES.includes(source)) {
      return NextResponse.json(
        { error: `source must be one of: ${VALID_SOURCES.join(", ")}` },
        { status: 400 }
      )
    }

    //////////////////////////////////////////////////////
    // VALIDATE expiresAt (if provided)
    //////////////////////////////////////////////////////

    let parsedExpiresAt: Date | undefined = undefined

    if (expiresAt !== undefined && expiresAt !== null) {
      parsedExpiresAt = new Date(expiresAt)

      if (isNaN(parsedExpiresAt.getTime())) {
        return NextResponse.json(
          { error: "expiresAt must be a valid date" },
          { status: 400 }
        )
      }

      if (parsedExpiresAt <= new Date()) {
        return NextResponse.json(
          { error: "expiresAt must be a future date" },
          { status: 400 }
        )
      }
    }

    //////////////////////////////////////////////////////
    // TRANSACTION — deactivate previous, create new
    //////////////////////////////////////////////////////

    const snapshot = await prisma.$transaction(async (tx) => {
      await tx.marketSignalSnapshot.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      })

      return tx.marketSignalSnapshot.create({
        data: {
          cPrice,
          demandIndex,
          source,
          isActive: true,
          note: note ?? null,
          expiresAt: parsedExpiresAt ?? null,
        },
      })
    })

    return NextResponse.json(snapshot)
  } catch (error) {
    console.error("[MARKET_SIGNAL_POST]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
