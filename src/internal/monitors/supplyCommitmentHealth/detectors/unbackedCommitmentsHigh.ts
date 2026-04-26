// =====================================================
// DETECTOR — UNBACKED_COMMITMENTS_HIGH
//
// Inputs: unbackedCommitment.shareOfMonthlyDraw
//         (= Σ monthlyGreenKg of committed contracts
//            pinned to a lot that is NOT in the
//            published supply set / monthlyDrawGreen)
// Axis:   supply  (backing fragility)
//
// Fires when too much of the committed monthly draw is
// pinned to lots that have disappeared from the
// contractable pool — a structural backing failure.
//
// Note: contracts with greenLotId = null are NOT in
// scope for this detector (see metrics/inputs.ts —
// computeUnbackedCommitment for the rationale).
//
// Edge cases:
//   - shareOfMonthlyDraw = null (no monthly draw at all)
//     → no fire. There is nothing to be unbacked against.
//   - contractCount = 0 → shareOfMonthlyDraw is 0 and the
//     detector does not fire.
// =====================================================

import { UNBACKED_COMMITMENTS_HIGH } from "../config.ts"
import type { DetectorResult, Metrics } from "../types.ts"

export function detectUnbackedCommitmentsHigh(
  metrics: Metrics
): DetectorResult | null {

  const { contractCount, monthlyGreenKg, shareOfMonthlyDraw, contractIds } =
    metrics.unbackedCommitment

  if (shareOfMonthlyDraw === null) return null

  let severity: DetectorResult["severity"] | null = null
  let threshold = UNBACKED_COMMITMENTS_HIGH.WATCH

  if (shareOfMonthlyDraw >= UNBACKED_COMMITMENTS_HIGH.CRITICAL) {
    severity = "CRITICAL"
    threshold = UNBACKED_COMMITMENTS_HIGH.CRITICAL
  } else if (shareOfMonthlyDraw >= UNBACKED_COMMITMENTS_HIGH.STRESSED) {
    severity = "STRESSED"
    threshold = UNBACKED_COMMITMENTS_HIGH.STRESSED
  } else if (shareOfMonthlyDraw >= UNBACKED_COMMITMENTS_HIGH.WATCH) {
    severity = "WATCH"
    threshold = UNBACKED_COMMITMENTS_HIGH.WATCH
  }

  if (severity === null) return null

  return {
    name: "UNBACKED_COMMITMENTS_HIGH",
    severity,
    axis: "supply",
    observed: shareOfMonthlyDraw,
    threshold,
    rationale: {
      contractCount,
      monthlyGreenKg,
      shareOfMonthlyDraw,
    },
    contributingIds: {
      contractIds,
    },
  }
}
