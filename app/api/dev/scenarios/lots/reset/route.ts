export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"

import { requireDevRoute } from "@/src/lib/dev/requireDevRoute"
import { resetDevScenarios } from "@/src/services/dev/scenarios/devLotScenario.service"

//////////////////////////////////////////////////////
// 🧪 POST /api/dev/scenarios/lots/reset
//
// Deletes every DEV-SCENARIO-prefixed row (lots, drafts,
// pricing snapshots, shipments) plus their dependents
// (demand intents, contracts, fulfilments). NEVER deletes
// the dev producer / user / [DEV] farms — those are
// shared across reseeds.
//
// Auth: requireDevRoute({ requireUser: true }).
//////////////////////////////////////////////////////

export async function POST() {
  const guard = await requireDevRoute({ requireUser: true })
  if (!guard.ok) return guard.response

  try {
    const result = await resetDevScenarios()
    return NextResponse.json(result)
  } catch (error) {
    console.error("[DEV_SCENARIO_RESET] error:", error)
    const msg = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      { error: "Failed to reset dev scenarios", detail: msg },
      { status: 500 }
    )
  }
}
