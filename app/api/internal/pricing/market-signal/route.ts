export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"

import { requireDevRoute } from "@/src/lib/dev/requireDevRoute"
import {
  applyMarketSignalIngestion,
  listRecentMarketSignalSnapshots,
  previewMarketSignalIngestion,
} from "@/src/services/pricing/marketSignalIngestion.service"
import type { MarketSignalIngestionCandidate } from "@/src/services/pricing/marketSignalIngestion.types"

//////////////////////////////////////////////////////
// 📡 INTERNAL — /api/internal/pricing/market-signal
//
//   GET  → active snapshot + last 10 snapshots
//   POST → preview by default; { apply: true, confirm: "APPLY_MARKET_SIGNAL" } persists.
//
// Auth: requireDevRoute({ requireUser: true }).
//
// IMPORTANT: this route NEVER updates PricingSnapshot.clientB2BPricePerKg.
// It only writes MarketSignalSnapshot. B2B refresh is a separate explicit
// step on /dev/pricing.
//////////////////////////////////////////////////////

const APPLY_CONFIRM_TOKEN = "APPLY_MARKET_SIGNAL"

export async function GET() {
  const guard = await requireDevRoute({ requireUser: true })
  if (!guard.ok) return guard.response

  try {
    const recent = await listRecentMarketSignalSnapshots(10)
    const active = recent.find((r) => r.isActive) ?? null
    return NextResponse.json({ active, recent })
  } catch (error) {
    console.error("[MARKET_SIGNAL_INGESTION_GET] error:", error)
    return NextResponse.json({ error: "Read failed" }, { status: 500 })
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

  // Pull the ingestion candidate fields out of the body. We
  // pass them through verbatim — the validator does its own
  // type / range checks and returns a structured diagnostics
  // array which is what the route responds with.
  const candidate: MarketSignalIngestionCandidate = {
    cPrice: body.cPrice as number,
    demandIndex: body.demandIndex as number,
    source: body.source as any,
    note: typeof body.note === "string" ? body.note : null,
    validFrom: (body.validFrom as string | null | undefined) ?? null,
    expiresAt: (body.expiresAt as string | null | undefined) ?? null,
    provenance:
      (body.provenance && typeof body.provenance === "object")
        ? (body.provenance as MarketSignalIngestionCandidate["provenance"])
        : undefined,
  }

  const wantsApply = body.apply === true
  if (wantsApply && body.confirm !== APPLY_CONFIRM_TOKEN) {
    return NextResponse.json(
      { error: `apply=true requires confirm="${APPLY_CONFIRM_TOKEN}"` },
      { status: 400 },
    )
  }

  try {
    if (!wantsApply) {
      const preview = await previewMarketSignalIngestion(candidate)
      const status = preview.ok ? 200 : 400
      return NextResponse.json(preview, { status })
    }

    const apply = await applyMarketSignalIngestion(candidate)
    const status = apply.ok && apply.applied ? 200 : 400
    return NextResponse.json(apply, { status })
  } catch (error) {
    console.error("[MARKET_SIGNAL_INGESTION_POST] error:", error)
    return NextResponse.json({ error: "Ingestion failed" }, { status: 500 })
  }
}
