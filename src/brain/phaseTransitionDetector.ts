import type { EngineState } from "@/src/engine/core/runtime"

// =====================================================
// PHASE TRANSITION DETECTOR
//
// Detecta pérdida progresiva de estabilidad estructural
// antes de una transición de régimen.
//
// Señales utilizadas:
// - criticalSlowing
// - collapseProximity
// - lyapunovIndicator
// - systemEnergy
//
// Output:
// 0 → sistema estable
// 1 → transición crítica inminente
// =====================================================

export function computePhaseTransitionRisk(
  state: EngineState
) {

  const slowing =
    state.criticalSlowing ?? 0

  const collapse =
    state.collapseProximity ?? 0

  const lyapunov =
    state.lyapunovIndicator ?? 0

  const energy =
    state.systemEnergy ?? 0

  const rawSignal =
      slowing * 0.35 +
      collapse * 0.35 +
      lyapunov * 0.2 +
      energy * 0.1

  return Math.max(0, Math.min(1, rawSignal))
}