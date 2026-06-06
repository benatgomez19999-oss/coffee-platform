export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"

import { requireDevRoute } from "@/src/lib/dev/requireDevRoute"
import {
  seedContractScenario,
  type SeedDevContractScenarioInput,
} from "@/src/services/dev/scenarios/devContractScenario.service"
import {
  DevContractScenarioError,
  isDevContractScenarioKind,
  type DevContractScenarioKind,
} from "@/src/services/dev/scenarios/devContractScenario.types"

//////////////////////////////////////////////////////
// 🧪 POST /api/dev/scenarios/contracts/seed
//
// Body:
//   { "scenario": "empty_contracts" | "one_pending_signature"
//                | "one_active_contract" | "mixed_contract_portfolio"
//                | "demand_intent_pending",
//     "seed"?: string,
//     "clientEmail"?: string }
//
// Auth: requireDevRoute({ requireUser: true }).
// Never seeds lots. Errors clearly when no eligible dev lots exist.
//////////////////////////////////////////////////////

export async function POST(req: Request) {
  const guard = await requireDevRoute({ requireUser: true })
  if (!guard.ok) return guard.response

  let raw: unknown = {}
  try {
    raw = await req.json()
  } catch {
    raw = {}
  }

  let parsed: SeedDevContractScenarioInput
  try {
    parsed = parseSeedBody(raw)
  } catch (err) {
    if (err instanceof DevContractScenarioError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status })
    }
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  try {
    const result = await seedContractScenario(parsed)
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    if (err instanceof DevContractScenarioError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status })
    }
    console.error("[DEV_CONTRACT_SCENARIO_SEED] error:", err)
    return NextResponse.json(
      { error: "Failed to seed dev contract scenario", detail: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    )
  }
}

function parseSeedBody(raw: unknown): SeedDevContractScenarioInput {
  const body =
    typeof raw === "object" && raw !== null
      ? (raw as Record<string, unknown>)
      : {}

  const scenarioRaw = body.scenario
  if (body.scenario != null && !isDevContractScenarioKind(scenarioRaw)) {
    throw new DevContractScenarioError(
      `Invalid scenario: ${String(scenarioRaw)}`,
      "DEV_CONTRACT_INVALID_SCENARIO",
    )
  }
  const scenario: DevContractScenarioKind = isDevContractScenarioKind(scenarioRaw)
    ? scenarioRaw
    : "empty_contracts"

  const seed =
    typeof body.seed === "string" && body.seed.trim().length > 0
      ? body.seed.trim()
      : undefined

  const clientEmail =
    typeof body.clientEmail === "string" && body.clientEmail.trim().length > 0
      ? body.clientEmail.trim()
      : undefined

  return { scenario, seed, clientEmail }
}
