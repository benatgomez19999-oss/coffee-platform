export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"

import { requireDevRoute } from "@/src/lib/dev/requireDevRoute"
import {
  listMarketSignalTicks,
  recordMarketSignalTickFromProviderPreview,
} from "@/src/services/pricing/marketSignalTick.service"
import type { MarketSignalProviderPreview } from "@/src/services/pricing/marketSignalProviders.types"

//////////////////////////////////////////////////////
// 📈 INTERNAL — /api/internal/pricing/market-signal/ticks
//
//   GET   → list recent provider preview ticks (newest first)
//   POST  → record one tick from a MarketSignalProviderPreview
//
// Auth: requireDevRoute({ requireUser: true }).
//
// THIS ROUTE ONLY APPENDS to MarketSignalTick.
// It NEVER writes MarketSignalSnapshot.
// It NEVER refreshes PricingSnapshot.clientB2BPricePerKg.
// It NEVER mutates Contract.lockedPricePerKg.
// It NEVER mutates DemandIntent.previewPricePerKg.
//////////////////////////////////////////////////////

function parseLimit(raw: string | null): number | undefined {
  if (raw == null) return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}

export async function GET(req: Request) {
  const guard = await requireDevRoute({ requireUser: true })
  if (!guard.ok) return guard.response

  try {
    const url = new URL(req.url)
    const providerId = url.searchParams.get("providerId")?.trim() || undefined
    const limit = parseLimit(url.searchParams.get("limit"))
    const since = url.searchParams.get("since") ?? undefined

    const result = await listMarketSignalTicks({
      providerId,
      limit,
      since,
    })
    return NextResponse.json(result)
  } catch (error) {
    console.error("[MARKET_SIGNAL_TICKS_GET] error:", error)
    return NextResponse.json({ error: "Tick list failed" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const guard = await requireDevRoute({ requireUser: true })
  if (!guard.ok) return guard.response

  let body: Record<string, unknown> = {}
  try {
    const raw = await req.json()
    body = (typeof raw === "object" && raw !== null) ? (raw as Record<string, unknown>) : {}
  } catch {
    body = {}
  }

  const previewRaw = body.preview ?? body
  if (!previewRaw || typeof previewRaw !== "object") {
    return NextResponse.json(
      { error: "Body must include a MarketSignalProviderPreview either at top level or under `preview`." },
      { status: 400 },
    )
  }

  const preview = previewRaw as unknown as MarketSignalProviderPreview

  try {
    const result = await recordMarketSignalTickFromProviderPreview(preview)
    const status = result.ok && result.applied ? 200 : 400
    return NextResponse.json(result, { status })
  } catch (error) {
    console.error("[MARKET_SIGNAL_TICKS_POST] error:", error)
    return NextResponse.json({ error: "Tick record failed" }, { status: 500 })
  }
}
