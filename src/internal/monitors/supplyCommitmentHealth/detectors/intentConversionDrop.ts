// =====================================================
// DETECTOR — INTENT_CONVERSION_DROP
//
// AXIS: demand
//
// Compares intent conversion in the trailing 7-day
// window to the prior 7-day window. Bands are negative.
// =====================================================

import { INTENT_CONVERSION_DROP } from "../config.ts"
import type { DetectorResult, Metrics } from "../types.ts"

export function detectIntentConversionDrop(
  metrics: Metrics
): DetectorResult | null {

  const { current7d, prior7d, deltaPts } = metrics.intentConversion
  if (deltaPts === null) return null

  let severity: DetectorResult["severity"] | null = null
  let threshold = INTENT_CONVERSION_DROP.WATCH

  // bands are negative percentage points
  if (deltaPts <= INTENT_CONVERSION_DROP.CRITICAL) {
    severity = "CRITICAL"
    threshold = INTENT_CONVERSION_DROP.CRITICAL
  } else if (deltaPts <= INTENT_CONVERSION_DROP.STRESSED) {
    severity = "STRESSED"
    threshold = INTENT_CONVERSION_DROP.STRESSED
  } else if (deltaPts <= INTENT_CONVERSION_DROP.WATCH) {
    severity = "WATCH"
    threshold = INTENT_CONVERSION_DROP.WATCH
  }

  if (severity === null) return null

  return {
    name: "INTENT_CONVERSION_DROP",
    severity,
    axis: "demand",
    observed: deltaPts,
    threshold,
    rationale: {
      current7dRate: current7d,
      prior7dRate: prior7d,
      deltaPts,
    },
    contributingIds: {},
  }
}
