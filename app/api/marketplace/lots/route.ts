export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"

import { requireAuth } from "@/src/lib/requireAuth"
import { getMarketplaceLotsView } from "@/src/services/allocation/marketplace/marketplaceView.service"

//////////////////////////////////////////////////////
// 🛍️ GET /api/marketplace/lots
//
// Customer-facing read of allocation-aware marketplace
// inventory. Returns only lots that the allocation
// engine has classified as marketplace-eligible
// (OPEN_MARKETPLACE | EXCLUSIVE_MICROLOT | SPLIT) with
// at least one of marketplaceEligibleGreenKg or
// exclusiveMicrolotGreenKg > 0.
//
// Auth: requireAuth() — same pattern as /api/market.
// All authenticated platform users may read this.
// No role restriction (matches the page guard at
// /platform/marketplace).
//////////////////////////////////////////////////////

export async function GET() {
  try {
    await requireAuth()

    const view = await getMarketplaceLotsView()
    return NextResponse.json(view)
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    console.error("[MARKETPLACE_LOTS] error:", error)
    return NextResponse.json(
      { error: "Unable to load marketplace lots" },
      { status: 500 }
    )
  }
}
