export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"

import { requireAuth } from "@/src/lib/requireAuth"
import { getContractCatalogView } from "@/src/services/allocation/contracts/contractCatalogView.service"

//////////////////////////////////////////////////////
// 📄 GET /api/contracts/catalog
//
// Read-only client-facing read of allocation-aware
// contract catalog inventory. Returns only lots that:
//   - the allocation engine assigns to CONTRACT_CATALOG
//     or SPLIT (with non-zero contractAssignableGreenKg)
//   - have a usable green producer price.
//
// Pricing is INDICATIVE (same target-anchored adaptive
// pipeline the marketplace uses). It is NOT persisted
// here and contracts are NOT created from this surface
// in this sprint — see PRICING-B2B-3 for the persistence
// + signing wiring.
//
// Auth: requireAuth() — same pattern as /api/marketplace/lots.
// All authenticated platform users may read this.
//////////////////////////////////////////////////////

export async function GET() {
  try {
    await requireAuth()

    const view = await getContractCatalogView()
    return NextResponse.json(view)
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    console.error("[CONTRACT_CATALOG] error:", error)
    return NextResponse.json(
      { error: "Unable to load contract catalog" },
      { status: 500 }
    )
  }
}
