// =====================================================
// DETECTOR — SUPPLY_DIVERSITY_LOW
//
// Inputs: supplyDiversity.distinctFarmCount
// Axis:   supply  (structural fragility)
//
// Bands are LESS THAN. Farms are the unit of supply-side
// fragility — lots rotate within farms, so distinct farm
// count is the load-bearing diversity signal. Lot count
// is reported in the metric for context but not read by
// this detector.
//
// Edge case: zero farms with zero published supply is
// consistent with a brand-new platform and should NOT
// fire here. The COMMITMENT_LOAD_HIGH detector already
// handles the catastrophic "zero published with
// commitments" case from the commitment axis.
// =====================================================

import { SUPPLY_DIVERSITY_LOW } from "../config.ts"
import type { DetectorResult, Metrics } from "../types.ts"

export function detectSupplyDiversityLow(
  metrics: Metrics
): DetectorResult | null {

  const { distinctFarmCount, distinctLotCount } = metrics.supplyDiversity

  // No published supply at all → not a diversity story.
  if (distinctFarmCount === 0) return null

  let severity: DetectorResult["severity"] | null = null
  let threshold = SUPPLY_DIVERSITY_LOW.WATCH

  if (distinctFarmCount < SUPPLY_DIVERSITY_LOW.CRITICAL) {
    severity = "CRITICAL"
    threshold = SUPPLY_DIVERSITY_LOW.CRITICAL
  } else if (distinctFarmCount < SUPPLY_DIVERSITY_LOW.STRESSED) {
    severity = "STRESSED"
    threshold = SUPPLY_DIVERSITY_LOW.STRESSED
  } else if (distinctFarmCount < SUPPLY_DIVERSITY_LOW.WATCH) {
    severity = "WATCH"
    threshold = SUPPLY_DIVERSITY_LOW.WATCH
  }

  if (severity === null) return null

  return {
    name: "SUPPLY_DIVERSITY_LOW",
    severity,
    axis: "supply",
    observed: distinctFarmCount,
    threshold,
    rationale: {
      distinctFarmCount,
      distinctLotCount,
    },
    contributingIds: {},
  }
}
