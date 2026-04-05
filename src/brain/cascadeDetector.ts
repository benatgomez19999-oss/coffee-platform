// =====================================================
// CASCADE DETECTOR — SYSTEMIC INSTABILITY COUPLING
//
// Detecta cuando múltiples campos estructurales
// comienzan a amplificarse mutuamente.
//
// NO calcula física nueva.
// Solo interpreta señales ya existentes.
// =====================================================

import type { EngineState } from "@/src/engine/core/runtime"

export function computeCascadeRisk(
  state: EngineState
) {

  const energy =
    state.systemEnergy ?? 0

  const fatigue =
    state.systemFatigue ?? 0

  const supplyStress =
    state.supplyStressField ?? 0

  const slowing =
    state.criticalSlowing ?? 0

  const lyapunov =
    state.lyapunovIndicator ?? 0

  const collapse =
    state.collapseProximity ?? 0

  // =====================================================
  // STRUCTURAL COUPLING FIELD
  // =====================================================

  const cascadeSignal =
      energy * 0.2 +
      fatigue * 0.2 +
      supplyStress * 0.2 +
      slowing * 0.2 +
      lyapunov * 0.1 +
      collapse * 0.1

  const cascadeRisk =
    Math.max(0, Math.min(1, cascadeSignal))

  return cascadeRisk

}