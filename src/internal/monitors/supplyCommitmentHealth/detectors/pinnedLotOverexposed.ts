// =====================================================
// DETECTOR — PINNED_LOT_OVEREXPOSED
//
// Inputs: pinnedLotExposure.worstRatio
//         pinnedLotExposure.depletedPinnedLotIds
// Axis:   supply  (backing fragility)
//
// Two paths to fire:
//
//   1. RATIO PATH — worstRatio is finite and crosses a
//      band. ratio = Σ pinned monthly draw on a single
//      lot / lot.availableKg. A ratio of 1 means one
//      month of draw is fully pinned to a single lot
//      with no remaining headroom.
//
//   2. DEPLETED PATH — at least one pinned lot has
//      availableKg = 0. This is mathematically the
//      worst case (infinite ratio) and forces CRITICAL
//      regardless of the ratio path.
//
// The depleted path takes precedence: if both paths
// fire, the result is CRITICAL.
// =====================================================

import { PINNED_LOT_OVEREXPOSED } from "../config.ts"
import type { DetectorResult, Metrics } from "../types.ts"

export function detectPinnedLotOverexposed(
  metrics: Metrics
): DetectorResult | null {

  const {
    worstLotId,
    worstRatio,
    exposedLotCount,
    totalPinnedMonthlyGreen,
    depletedPinnedLotIds,
  } = metrics.pinnedLotExposure

  const hasDepleted = depletedPinnedLotIds.length > 0

  let severity: DetectorResult["severity"] | null = null
  let threshold = PINNED_LOT_OVEREXPOSED.WATCH

  if (worstRatio !== null) {
    if (worstRatio >= PINNED_LOT_OVEREXPOSED.CRITICAL) {
      severity = "CRITICAL"
      threshold = PINNED_LOT_OVEREXPOSED.CRITICAL
    } else if (worstRatio >= PINNED_LOT_OVEREXPOSED.STRESSED) {
      severity = "STRESSED"
      threshold = PINNED_LOT_OVEREXPOSED.STRESSED
    } else if (worstRatio >= PINNED_LOT_OVEREXPOSED.WATCH) {
      severity = "WATCH"
      threshold = PINNED_LOT_OVEREXPOSED.WATCH
    }
  }

  // Depleted pinned lots force CRITICAL.
  if (hasDepleted) {
    severity = "CRITICAL"
    threshold = PINNED_LOT_OVEREXPOSED.CRITICAL
  }

  if (severity === null) return null

  return {
    name: "PINNED_LOT_OVEREXPOSED",
    severity,
    axis: "supply",
    observed: worstRatio,
    threshold,
    rationale: {
      worstLotId,
      worstRatio,
      exposedLotCount,
      totalPinnedMonthlyGreen,
      depletedPinnedLotCount: depletedPinnedLotIds.length,
    },
    contributingIds: {
      greenLotIds: hasDepleted
        ? depletedPinnedLotIds
        : worstLotId !== null
          ? [worstLotId]
          : [],
    },
  }
}
