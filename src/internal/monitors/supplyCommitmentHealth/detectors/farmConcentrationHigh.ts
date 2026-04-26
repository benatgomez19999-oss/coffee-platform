// =====================================================
// DETECTOR — FARM_CONCENTRATION_HIGH
//
// Inputs: farmConcentration.topNShare
//         (Σ availableKg of top-N farms / publishedSupplyGreen)
// Axis:   supply  (structural fragility)
//
// Fires when too much of the published green sits with
// too few farms. A null share (no published supply)
// produces no fire — the COMMITMENT_LOAD_HIGH detector
// already covers the "zero published supply" catastrophe
// from the commitment side, so we do not double-count
// here.
// =====================================================

import { FARM_CONCENTRATION_HIGH } from "../config.ts"
import type { DetectorResult, Metrics } from "../types.ts"

export function detectFarmConcentrationHigh(
  metrics: Metrics
): DetectorResult | null {

  const { topNShare, topNFarmIds, distinctFarmCount, totalGreen } =
    metrics.farmConcentration

  if (topNShare === null) return null

  let severity: DetectorResult["severity"] | null = null
  let threshold = FARM_CONCENTRATION_HIGH.WATCH

  if (topNShare >= FARM_CONCENTRATION_HIGH.CRITICAL) {
    severity = "CRITICAL"
    threshold = FARM_CONCENTRATION_HIGH.CRITICAL
  } else if (topNShare >= FARM_CONCENTRATION_HIGH.STRESSED) {
    severity = "STRESSED"
    threshold = FARM_CONCENTRATION_HIGH.STRESSED
  } else if (topNShare >= FARM_CONCENTRATION_HIGH.WATCH) {
    severity = "WATCH"
    threshold = FARM_CONCENTRATION_HIGH.WATCH
  }

  if (severity === null) return null

  return {
    name: "FARM_CONCENTRATION_HIGH",
    severity,
    axis: "supply",
    observed: topNShare,
    threshold,
    rationale: {
      topN: FARM_CONCENTRATION_HIGH.TOP_N,
      topNShare,
      distinctFarmCount,
      totalGreen,
    },
    contributingIds: {
      // Farms are not first-class entities in the report's
      // contributingIds shape (no farmIds bucket); the top
      // farm ids live in the metric itself for downstream
      // consumers, and attribution wires green-lot ids.
    },
  }
}
