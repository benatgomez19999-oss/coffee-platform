import { NextResponse } from "next/server"
import { requireAuth } from "@/src/lib/requireAuth"
import { getMarketView } from "@/src/services/clients/market.service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// ======================================================
// MARKET VIEW — CLIENT-FACING SUPPLY SNAPSHOT
//
// Returns roasted-primary availability and pricing
// for all published lots, grouped by region.
//
// All values are pre-computed. Frontend renders as-is.
// ======================================================

export async function GET() {
  try {
    const user = await requireAuth()

    if (!user.companyId) {
      return NextResponse.json(
        { error: "User has no company" },
        { status: 403 }
      )
    }

    const marketView = await getMarketView()

    return NextResponse.json(marketView)

  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    console.error("MARKET VIEW ERROR:", error)

    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    )
  }
}
