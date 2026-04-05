// =====================================================
// SUPPLY CASCADE RISK
// Detecta colapso progresivo en la red de regiones
// =====================================================

import type { EngineState } from "@/src/engine/core/runtime"

export function computeSupplyCascadeRisk(
  state: EngineState
) {

  if (!state.regions?.length) return 0

  const utilizations = state.regions.map(r => {

    if (r.capacityKg <= 0) return 0

    return 1 - (r.availableKg / r.capacityKg)

  })

  const maxUtilization = Math.max(...utilizations)
  const avgUtilization =
    utilizations.reduce((a,b)=>a+b,0) / utilizations.length

  const cascadeRisk =
    maxUtilization * 0.6 +
    avgUtilization * 0.4

  return Math.min(1, cascadeRisk)
}