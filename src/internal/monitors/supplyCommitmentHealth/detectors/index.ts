// =====================================================
// DETECTORS — REGISTRY AND RUNNER
//
// Pure. Runs every detector in a fixed order, returns
// every fired result. Order is stable so output is
// deterministic for the same input.
// =====================================================

import type { DetectorResult, Metrics } from "../types.ts"

import { detectCommitmentLoadHigh } from "./commitmentLoadHigh.ts"
import { detectMonthsOfCoverLow } from "./monthsOfCoverLow.ts"
import { detectMonthsOfCoverCommittedLow } from "./monthsOfCoverCommittedLow.ts"
import { detectIntentPressureHigh } from "./intentPressureHigh.ts"
import { detectIntentConversionDrop } from "./intentConversionDrop.ts"
import { detectFulfilmentOverdue } from "./fulfilmentOverdue.ts"
// Phase 2 — supply-axis fragility detectors. Appended at
// the end of the registry so the order of Phase 1
// detectors is preserved exactly.
import { detectFarmConcentrationHigh } from "./farmConcentrationHigh.ts"
import { detectSupplyDiversityLow } from "./supplyDiversityLow.ts"
import { detectPinnedLotOverexposed } from "./pinnedLotOverexposed.ts"
import { detectUnbackedCommitmentsHigh } from "./unbackedCommitmentsHigh.ts"

type DetectorFn = (m: Metrics) => DetectorResult | null

// Stable order — drives the deterministic detector list.
export const DETECTOR_REGISTRY: DetectorFn[] = [
  detectCommitmentLoadHigh,
  detectMonthsOfCoverLow,
  detectMonthsOfCoverCommittedLow,
  detectIntentPressureHigh,
  detectIntentConversionDrop,
  detectFulfilmentOverdue,
  // Phase 2 — supply axis. Appended; never interleaved.
  detectFarmConcentrationHigh,
  detectSupplyDiversityLow,
  detectPinnedLotOverexposed,
  detectUnbackedCommitmentsHigh,
]

export function runDetectors(metrics: Metrics): DetectorResult[] {
  const out: DetectorResult[] = []
  for (const fn of DETECTOR_REGISTRY) {
    const result = fn(metrics)
    if (result) out.push(result)
  }
  return out
}

export {
  detectCommitmentLoadHigh,
  detectMonthsOfCoverLow,
  detectMonthsOfCoverCommittedLow,
  detectIntentPressureHigh,
  detectIntentConversionDrop,
  detectFulfilmentOverdue,
  detectFarmConcentrationHigh,
  detectSupplyDiversityLow,
  detectPinnedLotOverexposed,
  detectUnbackedCommitmentsHigh,
}
