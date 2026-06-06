export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"

import { requireDevRoute } from "@/src/lib/dev/requireDevRoute"
import { getMarketSignalTickInspection } from "@/src/services/pricing/marketSignalTick.service"

//////////////////////////////////////////////////////
// 🔍 INTERNAL — /api/internal/pricing/market-signal/ticks/[id]
//
// GET-only read of a single MarketSignalTick row, formatted
// for the dev inspector. Re-runs the FEED-3A sanitisers on
// read so historical rows can't leak secrets even if they
// were stored before the on-write sanitisation existed.
//
// Auth: requireDevRoute({ requireUser: true }).
//
// THIS ROUTE NEVER:
//   • writes / updates / deletes any MarketSignalTick row
//   • writes MarketSignalSnapshot
//   • refreshes PricingSnapshot.clientB2BPricePerKg
//   • mutates Contract.lockedPricePerKg
//   • mutates DemandIntent.previewPricePerKg
//   • exposes Barchart API keys
//////////////////////////////////////////////////////

export async function GET(
  _req: Request,
  context: { params: { id: string } },
) {
  const guard = await requireDevRoute({ requireUser: true })
  if (!guard.ok) return guard.response

  const idRaw = context.params?.id ?? ""

  try {
    const result = await getMarketSignalTickInspection(idRaw)
    if (!result.ok) {
      const status =
        result.error.code === "MST_TICK_INVALID_ID" ? 400 :
        result.error.code === "MST_TICK_NOT_FOUND"  ? 404 :
                                                       500
      return NextResponse.json(result, { status })
    }
    return NextResponse.json(result)
  } catch (error) {
    console.error("[MARKET_SIGNAL_TICK_INSPECT_GET] error:", error)
    return NextResponse.json(
      {
        ok: false,
        generatedAt: new Date().toISOString(),
        error: { code: "MST_TICK_NOT_FOUND", message: "Tick inspector failed." },
      },
      { status: 500 },
    )
  }
}
