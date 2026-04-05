// =====================================================
// GLOBAL SUPPLY PLANNER
// Calcula cuánto volumen debería reponerse por región
// =====================================================

import type { EngineState } from "@/src/engine/core/runtime"

export function computeSupplyPlan(
  state: EngineState
) {

  if (!state.regions?.length) return []

  const energy = state.systemEnergy ?? 0
  const momentum = Math.abs(state.pressureMomentum ?? 0)

  const messages: string[] = []

  for (const region of state.regions) {

    if (region.capacityKg <= 0) continue

    const ratio =
      region.availableKg / region.capacityKg

    const depletionSignal =
      (1 - ratio) * 0.7 +
      energy * 0.15 +
      momentum * 0.15

    // =====================================================
    // TARGET BUFFER
    // =====================================================

    const targetBuffer =
      region.capacityKg * 0.45

    const requiredVolume =
      Math.max(0, targetBuffer - region.availableKg)

    // =====================================================
    // CRITICAL REGION
    // =====================================================

    if (ratio < 0.15) {

      messages.push(
        `${region.name} critical — replenish ~${Math.round(requiredVolume)} kg`
      )

    }

    // =====================================================
    // HIGH PRIORITY
    // =====================================================

    else if (depletionSignal > 0.6) {

      messages.push(
        `${region.name} high demand risk — plan replenishment ~${Math.round(requiredVolume)} kg`
      )

    }

    // =====================================================
    // MEDIUM PRIORITY
    // =====================================================

    else if (depletionSignal > 0.45) {

      messages.push(
        `${region.name} moderate pressure — monitor supply levels`
      )

    }

  }

  return messages
}