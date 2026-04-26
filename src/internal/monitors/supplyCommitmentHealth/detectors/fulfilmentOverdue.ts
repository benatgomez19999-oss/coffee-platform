// =====================================================
// DETECTOR — FULFILMENT_OVERDUE
//
// AXIS: fulfilment
//
// Bands rely on overdue count, ratio, and oldest age.
// "Overdue" definition lives in metrics/derived.ts.
// =====================================================

import { FULFILMENT_OVERDUE } from "../config.ts"
import type { DetectorResult, Metrics } from "../types.ts"

export function detectFulfilmentOverdue(
  metrics: Metrics
): DetectorResult | null {

  const { overdueCount, overdueRatio, oldestOverdueDays } = metrics.fulfilment

  if (overdueCount < FULFILMENT_OVERDUE.WATCH.minOverdueCount) {
    return null
  }

  let severity: DetectorResult["severity"] = "WATCH"
  let threshold: number = FULFILMENT_OVERDUE.WATCH.minOverdueCount

  // STRESSED
  const stressedRatioOk =
    overdueRatio !== null &&
    overdueRatio >= FULFILMENT_OVERDUE.STRESSED.minOverdueRatio
  const stressedAgeOk =
    oldestOverdueDays !== null &&
    oldestOverdueDays >= FULFILMENT_OVERDUE.STRESSED.maxOldestDays

  if (stressedRatioOk || stressedAgeOk) {
    severity = "STRESSED"
    threshold = FULFILMENT_OVERDUE.STRESSED.minOverdueRatio
  }

  // CRITICAL
  const criticalRatioOk =
    overdueRatio !== null &&
    overdueRatio >= FULFILMENT_OVERDUE.CRITICAL.minOverdueRatio
  const criticalAgeOk =
    oldestOverdueDays !== null &&
    oldestOverdueDays >= FULFILMENT_OVERDUE.CRITICAL.maxOldestDays

  if (criticalRatioOk || criticalAgeOk) {
    severity = "CRITICAL"
    threshold = FULFILMENT_OVERDUE.CRITICAL.minOverdueRatio
  }

  return {
    name: "FULFILMENT_OVERDUE",
    severity,
    axis: "fulfilment",
    observed: overdueCount,
    threshold,
    rationale: {
      overdueCount,
      overdueRatio,
      oldestOverdueDays,
    },
    contributingIds: {},
  }
}
