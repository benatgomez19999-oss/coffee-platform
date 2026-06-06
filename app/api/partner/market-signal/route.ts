export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/src/database/prisma"
import { getUserFromRequest } from "@/src/lib/getUserFromRequest"
import { applyMarketSignalIngestion } from "@/src/services/pricing/marketSignalIngestion.service"
import {
  buildPartnerMarketSignalErrorResponse,
  buildPartnerMarketSignalResponse,
  parsePartnerMarketSignalBody,
  type PartnerApplyResultLike,
  type PartnerMarketSignalBody,
} from "@/src/services/pricing/partnerMarketSignalAdapter"

//////////////////////////////////////////////////////
// 📡 PARTNER MARKET-SIGNAL ROUTE — consolidated
//
// PRICING-FEED-1B consolidates the legacy validation +
// write logic behind the shared marketSignalIngestion
// service. The partner route now:
//
//   1. authenticates (PARTNER role) — unchanged.
//   2. parses the legacy body via parsePartnerMarketSignalBody.
//   3. runs applyMarketSignalIngestion (FEED-1) — the
//      same write path used by /dev/market-signal.
//   4. adapts the result back to the legacy response shape
//      (top-level snapshot fields), augmented with
//      diagnostics + ingestion summary.
//
// THIS ROUTE NEVER:
//   • refreshes PricingSnapshot.clientB2BPricePerKg
//   • mutates Contract.lockedPricePerKg
//   • mutates DemandIntent.previewPricePerKg
//   • bypasses the shared validateMarketSignalCandidate
//     ranges (cPrice 50–600, demandIndex 0.8–1.2,
//     expiresAt > validFrom > now).
//////////////////////////////////////////////////////

// ------------------------------------------------------
// GET — return the current active MarketSignalSnapshot
//
// Behaviour preserved from the legacy implementation:
// returns the raw Prisma row at top level, or null when
// nothing is active.
// ------------------------------------------------------

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

// ------------------------------------------------------
// POST — create a new active MarketSignalSnapshot
//
// All numeric / date / source / range checks live in the
// shared validateMarketSignalCandidate (FEED-1). The
// adapter layer maps the legacy body in / the legacy
// response shape out.
// ------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (user.role !== "PARTNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    let raw: PartnerMarketSignalBody | null = null
    try {
      const body = await req.json()
      raw = (typeof body === "object" && body !== null) ? body as PartnerMarketSignalBody : null
    } catch {
      raw = null
    }

    const parsed = parsePartnerMarketSignalBody(raw)
    if (!parsed.ok) {
      return NextResponse.json(
        buildPartnerMarketSignalErrorResponse({ diagnostics: parsed.diagnostics }),
        { status: parsed.httpStatus },
      )
    }

    const result = await applyMarketSignalIngestion(parsed.candidate)
    if (!result.ok || !result.applied || !result.createdSnapshot) {
      return NextResponse.json(
        buildPartnerMarketSignalErrorResponse({ diagnostics: result.diagnostics }),
        { status: 400 },
      )
    }

    // The service's createdSnapshot already serialises Date fields
    // to ISO strings — that's exactly what the adapter expects.
    const adapterResult: PartnerApplyResultLike = {
      ok: result.ok,
      applied: result.applied,
      diagnostics: result.diagnostics,
      createdSnapshot: result.createdSnapshot,
    }

    return NextResponse.json(buildPartnerMarketSignalResponse(adapterResult))
  } catch (error) {
    console.error("[MARKET_SIGNAL_POST]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
