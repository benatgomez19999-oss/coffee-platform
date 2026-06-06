export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"

import { requireDevRoute } from "@/src/lib/dev/requireDevRoute"
import { listDevScenarioData } from "@/src/services/dev/scenarios/devLotScenario.service"

//////////////////////////////////////////////////////
// 🧪 GET /api/dev/scenarios/lots
//
// Returns the current set of DEV-SCENARIO-prefixed lots
// (drafts + green lots + shipments) so the dev tool can
// render a faithful summary of what's already seeded.
//
// Auth: requireDevRoute({ requireUser: true }).
//////////////////////////////////////////////////////

export async function GET() {
  const guard = await requireDevRoute({ requireUser: true })
  if (!guard.ok) return guard.response

  try {
    const data = await listDevScenarioData()
    return NextResponse.json(data)
  } catch (error) {
    console.error("[DEV_SCENARIO_LIST] error:", error)
    return NextResponse.json(
      { error: "Unable to load dev scenario data" },
      { status: 500 }
    )
  }
}
