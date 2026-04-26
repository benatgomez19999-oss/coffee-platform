// =====================================================
// DETECTOR — MONTHS_OF_COVER_LOW
//
// AXIS: commitment (NOT supply).
//
// Reasoning: both inputs (contractableGreen and
// monthlyDrawGreen) are commitment-shaped — the first
// already nets out commitments, the second is derived
// from the committed contract set. A low value means
// "we have committed too much relative to what is left
// to draw against," which is pressure, not physical
// supply fragility.
//
// Regression test asserts axis === "commitment".
// =====================================================

import { MONTHS_OF_COVER_LOW } from "../config.ts"
import type { DetectorResult, Metrics } from "../types.ts"

export function detectMonthsOfCoverLow(
  metrics: Metrics
): DetectorResult | null {

  const value = metrics.monthsOfCover
  if (value === null) return null  // metric unavailable → no fire

  let severity: DetectorResult["severity"] | null = null
  let threshold = MONTHS_OF_COVER_LOW.WATCH

  if (value < MONTHS_OF_COVER_LOW.CRITICAL) {
    severity = "CRITICAL"
    threshold = MONTHS_OF_COVER_LOW.CRITICAL
  } else if (value < MONTHS_OF_COVER_LOW.STRESSED) {
    severity = "STRESSED"
    threshold = MONTHS_OF_COVER_LOW.STRESSED
  } else if (value < MONTHS_OF_COVER_LOW.WATCH) {
    severity = "WATCH"
    threshold = MONTHS_OF_COVER_LOW.WATCH
  }

  if (severity === null) return null

  return {
    name: "MONTHS_OF_COVER_LOW",
    severity,
    axis: "commitment",
    observed: value,
    threshold,
    rationale: {
      monthsOfCover: value,
      contractableGreen: metrics.contractableGreen,
      monthlyDrawGreen: metrics.monthlyDrawGreen,
    },
    contributingIds: {},
  }
}
