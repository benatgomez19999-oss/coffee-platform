export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"

import { requireDevRoute } from "@/src/lib/dev/requireDevRoute"
import { listContractScenarioStatus } from "@/src/services/dev/scenarios/devContractScenario.service"

//////////////////////////////////////////////////////
// 🧪 GET /api/dev/scenarios/contracts/status
//
// Read-only summary of dev contract scenario rows:
// counts + last 10 contracts + last 10 intents owned
// by the dev contract company.
//
// Auth: requireDevRoute({ requireUser: true }).
//////////////////////////////////////////////////////

export async function GET() {
  const guard = await requireDevRoute({ requireUser: true })
  if (!guard.ok) return guard.response

  try {
    const status = await listContractScenarioStatus()
    return NextResponse.json(status)
  } catch (err) {
    console.error("[DEV_CONTRACT_SCENARIO_STATUS] error:", err)
    return NextResponse.json(
      { error: "Failed to read dev contract scenario status" },
      { status: 500 },
    )
  }
}
