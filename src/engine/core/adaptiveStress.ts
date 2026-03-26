// =====================================================
// ADAPTIVE STRESS INDEX (ASI)
// Señal central de tensión del sistema.
// =====================================================

import type { EngineState } from "./runtime"

export function computeASI(
  state: EngineState,
  unifiedPressure: number
) {

  // presión inmediata
  const pressureComponent =
    unifiedPressure * 0.35

  // desgaste acumulado
  const fatigueComponent =
    state.systemFatigue * 0.25

  // shocks activos
  const shockComponent =
    state.shockLevel * 0.15

  // tendencia estructural
  const driftComponent =
    state.regimeDriftSignal * 0.15

  // contexto de régimen
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

  // saturación suave
  const asi =
    Math.tanh(raw * 1.5)

  return Math.max(0, Math.min(1, asi))
}