export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"

import { requireDevRoute } from "@/src/lib/dev/requireDevRoute"
import { resetContractScenarios } from "@/src/services/dev/scenarios/devContractScenario.service"

//////////////////////////////////////////////////////
// 🧪 POST /api/dev/scenarios/contracts/reset
//
// Deletes every dev-generated Contract + DemandIntent +
// SignatureToken + Order owned by the dev contract company.
// NEVER deletes GreenLot, PricingSnapshot, MarketSignal* or
// real-user contracts/intents. See devContractScenario.service.ts.
//
// Auth: requireDevRoute({ requireUser: true }).
//////////////////////////////////////////////////////

export async function POST() {
  const guard = await requireDevRoute({ requireUser: true })
  if (!guard.ok) return guard.response

  try {
    const summary = await resetContractScenarios()
    return NextResponse.json(summary)
  } catch (err) {
    console.error("[DEV_CONTRACT_SCENARIO_RESET] error:", err)
    return NextResponse.json(
      {
        error: "Failed to reset dev contract scenarios",
        detail: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
