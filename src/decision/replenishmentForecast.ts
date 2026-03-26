// =====================================================
// REPLENISHMENT FORECAST
// Detecta regiones que necesitarán reposición
// =====================================================

import type { EngineState } from "@/engine/core/runtime"

export function computeReplenishmentForecast(
  state: EngineState
) {

  if (!state.regions?.length) return []

  const energy = state.systemEnergy ?? 0
  const momentum = Math.abs(state.pressureMomentum ?? 0)

  const signals: string[] = []

  for (const region of state.regions) {

    if (region.capacityKg <= 0) continue

    const ratio =
      region.availableKg / region.capacityKg

    const depletionRisk =
      (1 - ratio) * 0.6 +
      energy * 0.2 +
      momentum * 0.2

    // -------------------------------------------------
    // CRITICAL
    // -------------------------------------------------

    if (ratio < 0.15) {

      signals.push(
        `${region.name} critically low — immediate replenishment required`
      )

    }

    // -------------------------------------------------
    // SHORT TERM
    // -------------------------------------------------

    else if (depletionRisk > 0.6) {

      signals.push(
        `${region.name} likely to require replenishment soon`
      )

    }

    // -------------------------------------------------
    // MEDIUM TERM
    // -------------------------------------------------

    else if (depletionRisk > 0.45) {

      signals.push(
        `${region.name} projected demand pressure increasing`
      )

    }

  }

  return signals
}