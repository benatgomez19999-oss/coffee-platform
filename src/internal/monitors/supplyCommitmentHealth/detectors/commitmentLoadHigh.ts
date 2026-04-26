// =====================================================
// DETECTOR — COMMITMENT_LOAD_HIGH
//
// Renamed from COMMITTED_OVER_PUBLISHED for clarity:
// the name now matches the commitmentHealth axis it
// drives, and avoids collision with the demand-side
// "pressure" terminology used by INTENT_PRESSURE_HIGH.
//
// Inputs: committedGreen, publishedSupplyGreen
// Axis:   commitment
// =====================================================

import { COMMITMENT_LOAD_HIGH } from "../config.ts"
import type { DetectorResult, Metrics } from "../types.ts"

export function detectCommitmentLoadHigh(
  metrics: Metrics
): DetectorResult | null {

  const { committedGreen, publishedSupplyGreen } = metrics

  if (publishedSupplyGreen <= 0) {
    // Catastrophic edge case: no published supply at all but we
    // have commitments. Treat this as CRITICAL on commitment.
    if (committedGreen > 0) {
      return {
        name: "COMMITMENT_LOAD_HIGH",
        severity: "CRITICAL",
        axis: "commitment",
        observed: null,
        threshold: COMMITMENT_LOAD_HIGH.CRITICAL,
        rationale: {
          reason: "ZERO_PUBLISHED_SUPPLY_WITH_COMMITMENTS",
          committedGreen,
          publishedSupplyGreen,
        },
        contributingIds: {},
      }
    }
    return null
  }

  const ratio = committedGreen / publishedSupplyGreen

  let severity: DetectorResult["severity"] | null = null
  let threshold = COMMITMENT_LOAD_HIGH.WATCH

  if (ratio >= COMMITMENT_LOAD_HIGH.CRITICAL) {
    severity = "CRITICAL"
    threshold = COMMITMENT_LOAD_HIGH.CRITICAL
  } else if (ratio > COMMITMENT_LOAD_HIGH.STRESSED) {
    severity = "STRESSED"
    threshold = COMMITMENT_LOAD_HIGH.STRESSED
  } else if (ratio > COMMITMENT_LOAD_HIGH.WATCH) {
    severity = "WATCH"
    threshold = COMMITMENT_LOAD_HIGH.WATCH
  }

  if (severity === null) return null

  return {
    name: "COMMITMENT_LOAD_HIGH",
    severity,
    axis: "commitment",
    observed: ratio,
    threshold,
    rationale: {
      committedGreen,
      publishedSupplyGreen,
      ratio,
    },
    contributingIds: {},
  }
}
