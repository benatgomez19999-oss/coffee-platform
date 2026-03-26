// =====================================================
// REGIONAL IMBALANCE DETECTOR
// Detecta distribución desigual de supply.
// =====================================================

import type { EngineState } from "@/engine/core/runtime"

export function computeRegionalImbalance(
  state: EngineState
) {

  if (!state.regions?.length) return 0

  const ratios = state.regions.map(region => {

    if (region.capacityKg <= 0) return 0

    return region.availableKg / region.capacityKg

  })

  const avg =
    ratios.reduce((a, b) => a + b, 0) / ratios.length

  const variance =
    ratios.reduce(
      (sum, r) => sum + Math.pow(r - avg, 2),
      0
    ) / ratios.length

  const imbalance =
    Math.sqrt(variance)

  return Math.min(1, imbalance * 2)

}