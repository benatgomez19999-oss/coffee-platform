export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"

import { requireDevRoute } from "@/src/lib/dev/requireDevRoute"
import { resetContractScenarios } from "@/src/services/dev/scenarios/devContractScenario.service"

//////////////////////////////////////////////////////
// 🧪 POST /api/dev/test-setup/reset
// DEV-TEST-SETUP-1
//
// Thin wrapper around resetContractScenarios — same
// service as /api/dev/scenarios/contracts/reset.
// Exposed here so the test-setup page has a single
// dev-only domain to call into.
//
// Auth: requireDevRoute({ requireUser: true }).
//
// Removes every Contract + DemandIntent + SignatureToken
// + Order owned by the DEV contract company. Lots are
// preserved.
//////////////////////////////////////////////////////

export async function POST() {
  const guard = await requireDevRoute({ requireUser: true })
  if (!guard.ok) return guard.response

  try {
    const summary = await resetContractScenarios()
    return NextResponse.json(summary)
  } catch (err) {
    console.error("[DEV_TEST_SETUP_RESET] error:", err)
    const msg = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: "Failed to reset dev intents/contracts", detail: msg },
      { status: 500 },
    )
  }
}
