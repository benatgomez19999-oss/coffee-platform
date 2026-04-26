// =====================================================
// FOUNDER DAILY INTELLIGENCE BRIEFING
//
// Single public entry point. Returns a FounderBriefing
// composed from Prisma + supplyCommitmentHealth monitor.
//
// READ-ONLY. INTERNAL-ONLY.
//
// Forbidden imports (enforced by hand in v1; ESLint
// guard deferred):
//   - src/AI/**           (simulation, opportunities)
//   - src/engine/**       (runtime, simulationReal)
//   - src/spatialMarket/** (regions, prices, flows)
//   - src/decision/**     (semaphore, livedecision)
//   - src/brain/**        (regimeLearning, memory)
//   - src/signals/**      (marketSignals, registry)
//   - openai              (no LLM in v1)
//
// =====================================================

import { loadFounderBriefingSnapshot } from "./dataAccess.ts"
import { buildSupplyHealthSection }     from "./sections/supplyHealth.ts"
import { buildContractPressureSection } from "./sections/contractPressure.ts"
import { buildIntentPressureSection }   from "./sections/intentPressure.ts"
import { buildOperationalWarnings }     from "./sections/operationalWarnings.ts"
import { buildRecommendedActions }      from "./sections/recommendedActions.ts"
import { formatFounderBriefingMarkdown } from "./formatters/markdown.ts"
import { BRIEFING_VERSION, DATA_SOURCES, EXCLUDED_SOURCES } from "./config.ts"

import type { FounderBriefing } from "./types.ts"

export type { FounderBriefing } from "./types.ts"
export { formatFounderBriefingMarkdown } from "./formatters/markdown.ts"

export async function buildFounderBriefing(args?: {
  now?: Date
}): Promise<FounderBriefing> {

  const now = args?.now ?? new Date()

  const snapshot = await loadFounderBriefingSnapshot(now)

  const supplyHealth        = buildSupplyHealthSection(snapshot)
  const contractPressure    = buildContractPressureSection(snapshot)
  const intentPressure      = buildIntentPressureSection(snapshot)
  const operationalWarnings = buildOperationalWarnings(snapshot)
  const recommendedActions  = buildRecommendedActions(
    supplyHealth.activeDetectors,
    operationalWarnings,
  )

  return {
    briefingVersion: BRIEFING_VERSION,
    monitorVersion:  snapshot.monitorReport.meta.monitorVersion,
    generatedAt:     now.toISOString(),
    inputFingerprint: snapshot.monitorReport.meta.inputFingerprint,
    inputCounts:     snapshot.inputCounts,
    supplyHealth,
    contractPressure,
    intentPressure,
    operationalWarnings,
    recommendedActions,
    notes: {
      advisoryOnly:    true,
      dataSources:     DATA_SOURCES,
      excludedSources: EXCLUDED_SOURCES,
    },
  }
}
