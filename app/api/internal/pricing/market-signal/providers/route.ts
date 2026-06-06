export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"

import { requireDevRoute } from "@/src/lib/dev/requireDevRoute"
import { listMarketSignalProviders } from "@/src/services/pricing/marketSignalProviders.pure"

//////////////////////////////////////////////////////
// 📡 GET /api/internal/pricing/market-signal/providers
//
// Returns the list of registered market-signal providers
// the operator can preview from. `configured` reflects
// whether the runtime currently has whatever the provider
// needs to actually return a candidate (e.g. an env API key).
//
// Auth: requireDevRoute({ requireUser: true }).
//////////////////////////////////////////////////////

export async function GET() {
  const guard = await requireDevRoute({ requireUser: true })
  if (!guard.ok) return guard.response

  try {
    const providers = listMarketSignalProviders()
    return NextResponse.json({ providers })
  } catch (error) {
    console.error("[MARKET_SIGNAL_PROVIDERS_LIST] error:", error)
    return NextResponse.json(
      { error: "Provider list failed" },
      { status: 500 },
    )
  }
}
