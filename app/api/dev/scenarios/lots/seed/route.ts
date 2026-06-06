export const runtime = "nodejs"
export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"

import { requireDevRoute } from "@/src/lib/dev/requireDevRoute"
import {
  DevScenarioError,
  seedDevScenario,
  type SeedDevScenarioInput,
} from "@/src/services/dev/scenarios/devLotScenario.service"
import {
  SEED_MAX_LENGTH,
  isDevScenarioKind,
  isDevTargetStage,
  type DevLotScenarioKind,
  type DevLotScenarioTargetStage,
  type DevLotVariationMode,
} from "@/src/services/dev/scenarios/devLotScenario.types"

//////////////////////////////////////////////////////
// 🧪 POST /api/dev/scenarios/lots/seed
//
// Body (all fields optional — sensible defaults apply):
//   {
//     "scenario": "allocation_engine_decides",
//     "targetStage": "published",
//     "count": 10,
//     "destinationCountry": "Norway"   // only used when
//                                      // targetStage = destination_received
//   }
//
// Auth: requireDevRoute({ requireUser: true }).
// Returns 400 for invalid scenario / targetStage / illegal combo.
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

  let parsed: SeedDevScenarioInput
  try {
    parsed = parseSeedBody(raw)
  } catch (error) {
    if (error instanceof DevScenarioError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  try {
    const result = await seedDevScenario(parsed)
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof DevScenarioError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("[DEV_SCENARIO_SEED] error:", error)
    const msg = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      { error: "Failed to seed dev scenario", detail: msg },
      { status: 500 }
    )
  }
}

//////////////////////////////////////////////////////
// BODY PARSING — narrow `unknown` to SeedDevScenarioInput
//////////////////////////////////////////////////////

function parseSeedBody(raw: unknown): SeedDevScenarioInput {
  const body =
    typeof raw === "object" && raw !== null
      ? (raw as Record<string, unknown>)
      : {}

  const scenarioRaw = body.scenario
  const scenario: DevLotScenarioKind = isDevScenarioKind(scenarioRaw)
    ? scenarioRaw
    : "allocation_engine_decides"

  if (body.scenario != null && !isDevScenarioKind(body.scenario)) {
    throw new DevScenarioError(`Invalid scenario: ${String(body.scenario)}`)
  }

  const targetStageRaw = body.targetStage
  const targetStage: DevLotScenarioTargetStage = isDevTargetStage(targetStageRaw)
    ? targetStageRaw
    : "published"

  if (body.targetStage != null && !isDevTargetStage(body.targetStage)) {
    throw new DevScenarioError(`Invalid targetStage: ${String(body.targetStage)}`)
  }

  const count =
    typeof body.count === "number" && Number.isFinite(body.count)
      ? body.count
      : undefined

  const destinationCountry =
    typeof body.destinationCountry === "string" && body.destinationCountry.trim().length > 0
      ? body.destinationCountry.trim()
      : undefined

  let variationMode: DevLotVariationMode | undefined = undefined
  if (body.variationMode != null) {
    if (body.variationMode === "deterministic" || body.variationMode === "jittered") {
      variationMode = body.variationMode
    } else {
      throw new DevScenarioError(
        `Invalid variationMode: ${String(body.variationMode)}`
      )
    }
  }

  let seed: string | undefined = undefined
  if (body.seed != null) {
    if (typeof body.seed !== "string") {
      throw new DevScenarioError("seed must be a string")
    }
    const trimmed = body.seed.trim()
    if (trimmed.length === 0) {
      throw new DevScenarioError("seed must not be empty")
    }
    if (trimmed.length > SEED_MAX_LENGTH) {
      throw new DevScenarioError(`seed must be ≤ ${SEED_MAX_LENGTH} chars`)
    }
    seed = trimmed
  }

  return {
    scenario,
    targetStage,
    count,
    destinationCountry,
    variationMode,
    seed,
  }
}
