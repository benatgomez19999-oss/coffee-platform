export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"

import { requireDevRoute } from "@/src/lib/dev/requireDevRoute"
import { getClientB2BPricingInspection } from "@/src/services/pricing/clientB2BPricingInspector.service"

//////////////////////////////////////////////////////
// 🔬 INTERNAL — /api/internal/pricing/lot/[id]
//
// Read-only rich pricing inspector for a single GreenLot.
// PRICING-ADMIN-1 upgrades this from the previous lightweight
// payload to a structured ClientB2BPricingInspection that
// surfaces:
//
//   • persisted vs recomputed B2B price (+ delta + status)
//   • producer green price + breakdown
//   • target table row (low / expected / high) with diagnostics
//   • commercial model layer (cost-plus vs market-anchored,
//     soft modifiers, clamp)
//   • active MarketSignalSnapshot metadata
//   • allocation surface + reason codes
//   • visibility flags (marketplace / contract catalog)
//
// Auth: requireDevRoute({ requireUser: true }).
// Mutates nothing.
//////////////////////////////////////////////////////

export async function GET(
  _req: Request,
  context: { params: { id: string } }
) {
  const guard = await requireDevRoute({ requireUser: true })
  if (!guard.ok) return guard.response

  const id = context.params?.id?.trim()
  if (!id) {
    return NextResponse.json({ error: "Missing lot id" }, { status: 400 })
  }

  try {
    const inspection = await getClientB2BPricingInspection(id)
    if (!inspection) {
      return NextResponse.json({ error: "Lot not found" }, { status: 404 })
    }
    return NextResponse.json(inspection)
  } catch (error) {
    console.error("[CLIENT_B2B_PRICING_INSPECTOR] error:", error)
    return NextResponse.json(
      { error: "Lot pricing inspector failed" },
      { status: 500 }
    )
  }
}
