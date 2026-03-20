// =====================================================
// MARKET FEEDBACK LOOP
// Ajusta comportamiento del mercado según estado del sistema
// =====================================================

import type { EngineState } from "@/engine/runtime"

export function computeMarketFeedback(
  state: EngineState
) {

  const regime = state.systemRegime
  const fatigue = state.systemFatigue ?? 0
  const energy = state.systemEnergy ?? 0

  let demandModifier = 1
  let volatilityModifier = 1

  // =====================================================
  // REGIME EFFECT
  // =====================================================

  if (regime === "Structural stress") {

    demandModifier *= 0.85
    volatilityModifier *= 1.2

  }

  // =====================================================
  // FATIGUE EFFECT
  // =====================================================

  if (fatigue > 0.4) {

    demandModifier *= 0.9
    volatilityModifier *= 1.1

  }

  // =====================================================
  // ENERGY EFFECT
  // =====================================================

  if (energy > 0.5) {

    volatilityModifier *= 1.15

  }

  return {

    demandModifier,
    volatilityModifier

  }
}