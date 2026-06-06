export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"

import { requireDevRoute } from "@/src/lib/dev/requireDevRoute"
import { previewMarketSignalFromProvider } from "@/src/services/pricing/marketSignalProviders.service"
import type { MarketSignalProviderScenario } from "@/src/services/pricing/marketSignalProviders.types"

//////////////////////////////////////////////////////
// 📡 POST /api/internal/pricing/market-signal/provider-preview
//
// Preview-only orchestration: resolves a provider, fetches its
// latest candidate, runs FEED-1 validation, and returns the
// composed `MarketSignalProviderPreview` payload.
//
// THIS ROUTE NEVER WRITES anything:
//   • no MarketSignalSnapshot row
//   • no PricingSnapshot.clientB2BPricePerKg
//   • no Contract / DemandIntent rows
//
// To turn the preview into an active snapshot, the operator
// must copy the candidate into the manual ingestion form on
// /dev/market-signal and apply through the existing
// PRICING-FEED-1 confirm-token flow.
//
// Auth: requireDevRoute({ requireUser: true }).
//////////////////////////////////////////////////////

const VALID_SCENARIOS: ReadonlyArray<MarketSignalProviderScenario> = [
  "low",
  "neutral",
  "high",
]

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

  const providerId =
    typeof body.providerId === "string" ? body.providerId.trim() : ""
  if (providerId.length === 0) {
    return NextResponse.json(
      { error: "providerId is required" },
      { status: 400 },
    )
  }

  const scenarioRaw =
    typeof body.scenario === "string" ? body.scenario.trim() : null
  const scenario: MarketSignalProviderScenario | undefined =
    scenarioRaw != null && VALID_SCENARIOS.includes(scenarioRaw as MarketSignalProviderScenario)
      ? (scenarioRaw as MarketSignalProviderScenario)
      : undefined

  try {
    const preview = await previewMarketSignalFromProvider({
      providerId,
      scenario,
    })
    return NextResponse.json(preview)
  } catch (error) {
    console.error("[MARKET_SIGNAL_PROVIDER_PREVIEW] error:", error)
    return NextResponse.json(
      { error: "Provider preview failed" },
      { status: 500 },
    )
  }
}
