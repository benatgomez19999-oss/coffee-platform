// =====================================================
// FOUNDER BRIEFING — SUPPLY HEALTH SECTION
//
// Forwarded wholesale from the CommitmentHealthReport.
// We do not re-derive axes or detector severities.
// =====================================================

import type { FounderBriefingSnapshot } from "../dataAccess.ts"
import type { ActiveDetector, SupplyHealthSection } from "../types.ts"
import { asGreenKg } from "../types.ts"
import { detectorHeadline } from "../lookups.ts"

export function buildSupplyHealthSection(
  snap: FounderBriefingSnapshot,
): SupplyHealthSection {

  const { healthAxes, metrics, detectors } = snap.monitorReport

  const activeDetectors: ActiveDetector[] = detectors.map(d => ({
    name:      d.name,
    severity:  d.severity,
    axis:      d.axis,
    observed:  d.observed,
    threshold: d.threshold,
    headline:  detectorHeadline(d.name, d.observed, d.threshold),
    rationale: d.rationale,
  }))

  return {
    axes: {
      supply:     healthAxes.supplyHealth,
      demand:     healthAxes.demandHealth,
      commitment: healthAxes.commitmentHealth,
      fulfilment: healthAxes.fulfilmentHealth,
      overall:    healthAxes.overallHealth,
    },
    keyMetrics: {
      publishedSupplyGreenKg:     asGreenKg(metrics.publishedSupplyGreen),
      contractableGreenKg:        asGreenKg(metrics.contractableGreen),
      committedGreenKg:           asGreenKg(metrics.committedGreen),
      monthlyDrawGreenKg:         asGreenKg(metrics.monthlyDrawGreen),
      monthsOfCover:              metrics.monthsOfCover,
      monthsOfCoverCommittedOnly: metrics.monthsOfCoverCommittedOnly,
    },
    activeDetectors,
  }
}
