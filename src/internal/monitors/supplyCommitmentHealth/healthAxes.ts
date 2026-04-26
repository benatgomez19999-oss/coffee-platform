// =====================================================
// HEALTH AXES — CONSERVATIVE-MAX ROLLUP
//
// Pure. Maps fired detectors to their respective axis,
// then takes the max severity per axis. overallHealth
// is the max across all four axes.
//
// As of v1.1.0 supplyHealth is driven by the four
// Phase 2 supply-fragility detectors. Prior to v1.1.0
// it had no detectors and always read OK.
// =====================================================

import { SEVERITY_ORDER } from "./types.ts"
import type {
  DetectorResult,
  HealthAxes,
  HealthSeverity,
} from "./types.ts"

function maxSeverity(
  a: HealthSeverity,
  b: HealthSeverity
): HealthSeverity {
  return SEVERITY_ORDER[a] >= SEVERITY_ORDER[b] ? a : b
}

export function rollupHealthAxes(
  detectors: DetectorResult[]
): HealthAxes {

  let supplyHealth: HealthSeverity = "OK"
  let demandHealth: HealthSeverity = "OK"
  let commitmentHealth: HealthSeverity = "OK"
  let fulfilmentHealth: HealthSeverity = "OK"

  for (const d of detectors) {
    switch (d.axis) {
      case "supply":
        supplyHealth = maxSeverity(supplyHealth, d.severity)
        break
      case "demand":
        demandHealth = maxSeverity(demandHealth, d.severity)
        break
      case "commitment":
        commitmentHealth = maxSeverity(commitmentHealth, d.severity)
        break
      case "fulfilment":
        fulfilmentHealth = maxSeverity(fulfilmentHealth, d.severity)
        break
    }
  }

  const overallHealth = [
    supplyHealth,
    demandHealth,
    commitmentHealth,
    fulfilmentHealth,
  ].reduce<HealthSeverity>(
    (acc, s) => maxSeverity(acc, s),
    "OK"
  )

  return {
    supplyHealth,
    demandHealth,
    commitmentHealth,
    fulfilmentHealth,
    overallHealth,
  }
}
