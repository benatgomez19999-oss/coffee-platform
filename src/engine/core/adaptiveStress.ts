// =====================================================
// ADAPTIVE STRESS INDEX (ASI)
// Señal central de tensión del sistema.
// =====================================================

import type { EngineState } from "@/src/engine/core/runtime"

export function computeASI(
  state: EngineState,
  unifiedPressure: number
) {
  // presión inmediata (componente rápido)
  const pressureComponent =
    unifiedPressure * 0.35

  // desgaste acumulado (componente lento)
  const fatigueComponent =
    state.systemFatigue * 0.25

  // shocks activos en curso
  const shockComponent =
    state.shockLevel * 0.15

  // tendencia estructural del régimen
  const driftComponent =
    state.regimeDriftSignal * 0.15

  // contexto de régimen (bias discreto)
  const regimeComponent =
    state.systemRegime === "Structural stress"
      ? 0.1
      : 0

  const raw =
    pressureComponent +
    fatigueComponent +
    shockComponent +
    driftComponent +
    regimeComponent

  // saturación suave (bounded non-linear response)
  const asi =
    Math.tanh(raw * 1.5)

  return Math.max(0, Math.min(1, asi))
}