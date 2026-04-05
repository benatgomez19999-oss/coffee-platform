// =====================================================
// ANTICIPATORY SHORTAGE DETECTION
// Detecta escasez futura antes de que ocurra
// =====================================================

import type { EngineState } from "@/src/engine/core/runtime"

export function computeAnticipatoryShortage(
  state: EngineState
) {

  const momentum =
    Math.abs(state.pressureMomentum ?? 0)

  const shocks =
    state.shockLevel ?? 0

  const energy =
    state.systemEnergy ?? 0

  const fatigue =
    state.systemFatigue ?? 0

  const anticipatorySignal =
    momentum * 0.35 +
    shocks * 0.25 +
    energy * 0.2 +
    fatigue * 0.2

  return Math.min(1, anticipatorySignal)
}