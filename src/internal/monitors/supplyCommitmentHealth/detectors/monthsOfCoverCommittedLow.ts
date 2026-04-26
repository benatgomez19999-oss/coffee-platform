// =====================================================
// DETECTOR — MONTHS_OF_COVER_COMMITTED_LOW
//
// AXIS: commitment
//
// Structural floor view: ignores intent pressure and
// only asks "if we honoured the existing book against
// the published base, how many months does the floor
// last?"
// =====================================================

import { MONTHS_OF_COVER_COMMITTED_LOW } from "../config.ts"
import type { DetectorResult, Metrics } from "../types.ts"

export function detectMonthsOfCoverCommittedLow(
  metrics: Metrics
): DetectorResult | null {

  const value = metrics.monthsOfCoverCommittedOnly

  // Catastrophic edge: publishedSupplyGreen = 0 with
  // committedGreen > 0. safeDiv returns null in that case
  // because committedGreen is the denominator-or-zero check
  // is on committedGreen — but here the "0/positive" case
  // returns 0 from safeDiv, which is correctly CRITICAL.
  // The "positive/0" case (committedGreen = 0) yields null
  // → no fire, which is also correct: nothing committed
  // means no floor risk.

  if (value === null) return null

  let severity: DetectorResult["severity"] | null = null
  let threshold = MONTHS_OF_COVER_COMMITTED_LOW.WATCH

  if (value < MONTHS_OF_COVER_COMMITTED_LOW.CRITICAL) {
    severity = "CRITICAL"
    threshold = MONTHS_OF_COVER_COMMITTED_LOW.CRITICAL
  } else if (value < MONTHS_OF_COVER_COMMITTED_LOW.STRESSED) {
    severity = "STRESSED"
    threshold = MONTHS_OF_COVER_COMMITTED_LOW.STRESSED
  } else if (value < MONTHS_OF_COVER_COMMITTED_LOW.WATCH) {
    severity = "WATCH"
    threshold = MONTHS_OF_COVER_COMMITTED_LOW.WATCH
  }

  if (severity === null) return null

  return {
    name: "MONTHS_OF_COVER_COMMITTED_LOW",
    severity,
    axis: "commitment",
    observed: value,
    threshold,
    rationale: {
      monthsOfCoverCommittedOnly: value,
      publishedSupplyGreen: metrics.publishedSupplyGreen,
      committedGreen: metrics.committedGreen,
    },
    contributingIds: {},
  }
}
