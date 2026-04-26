// =====================================================
// REPORT ASSEMBLY
//
// Pure. Combines metrics + detectors + axes + attribution
// + meta into a single CommitmentHealthReport.
//
// Detector ranking for `signals`: severity DESC, then
// magnitude (|observed - threshold|) DESC, then name
// alphabetically (stable tiebreaker).
// =====================================================

import { randomUUID } from "node:crypto"

import { MONITOR_VERSION } from "./constants.ts"
import { SIGNAL_TOP_N } from "./config.ts"
import { SEVERITY_ORDER } from "./types.ts"

import type {
  CommitmentHealthReport,
  DetectorResult,
  HealthAxes,
  Metrics,
  InputCounts,
  Attribution,
} from "./types.ts"

function rankDetectors(
  detectors: DetectorResult[]
): DetectorResult[] {
  return [...detectors].sort((a, b) => {
    const sa = SEVERITY_ORDER[a.severity]
    const sb = SEVERITY_ORDER[b.severity]
    if (sa !== sb) return sb - sa
    const magA =
      a.observed === null ? 0 : Math.abs(a.observed - a.threshold)
    const magB =
      b.observed === null ? 0 : Math.abs(b.observed - b.threshold)
    if (magA !== magB) return magB - magA
    return a.name.localeCompare(b.name)
  })
}

export function assembleReport(args: {
  runStartedAt: Date
  runFinishedAt: Date
  inputFingerprint: string
  inputCounts: InputCounts
  metrics: Metrics
  detectors: DetectorResult[]
  axes: HealthAxes
  attribution: Attribution
  runId?: string
}): CommitmentHealthReport {

  const ranked = rankDetectors(args.detectors)
  const signals = ranked.slice(0, SIGNAL_TOP_N)

  return {
    meta: {
      runId: args.runId ?? randomUUID(),
      monitorVersion: MONITOR_VERSION,
      runStartedAt: args.runStartedAt.toISOString(),
      runFinishedAt: args.runFinishedAt.toISOString(),
      durationMs: args.runFinishedAt.getTime() - args.runStartedAt.getTime(),
      inputFingerprint: args.inputFingerprint,
    },
    inputCounts: args.inputCounts,
    metrics: args.metrics,
    healthAxes: args.axes,
    detectors: ranked,
    signals,
    attribution: args.attribution,
  }
}
