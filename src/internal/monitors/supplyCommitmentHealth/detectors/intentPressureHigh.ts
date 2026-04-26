// =====================================================
// DETECTOR — INTENT_PRESSURE_HIGH
//
// AXIS: demand
//
// How much open demand-intent green is sitting against
// the contractable supply right now.
// =====================================================

import { INTENT_PRESSURE_HIGH } from "../config.ts"
import type { DetectorResult, Metrics } from "../types.ts"

export function detectIntentPressureHigh(
  metrics: Metrics
): DetectorResult | null {

  const ratio = metrics.intentPressureRatio
  if (ratio === null) return null

  let severity: DetectorResult["severity"] | null = null
  let threshold = INTENT_PRESSURE_HIGH.WATCH

  if (ratio > INTENT_PRESSURE_HIGH.CRITICAL) {
    severity = "CRITICAL"
    threshold = INTENT_PRESSURE_HIGH.CRITICAL
  } else if (ratio > INTENT_PRESSURE_HIGH.STRESSED) {
    severity = "STRESSED"
    threshold = INTENT_PRESSURE_HIGH.STRESSED
  } else if (ratio > INTENT_PRESSURE_HIGH.WATCH) {
    severity = "WATCH"
    threshold = INTENT_PRESSURE_HIGH.WATCH
  }

  if (severity === null) return null

  return {
    name: "INTENT_PRESSURE_HIGH",
    severity,
    axis: "demand",
    observed: ratio,
    threshold,
    rationale: {
      intentPressureRatio: ratio,
      activeOpenIntentGreenKg: metrics.activeOpenIntentLoad.greenKg,
      contractableGreen: metrics.contractableGreen,
      intentCount: metrics.activeOpenIntentLoad.intentCount,
    },
    contributingIds: {},
  }
}
