// =====================================================
// REGIONAL RISK DIAGNOSTICS
// Detecta qué regiones generan riesgo sistémico
// =====================================================

import type { EngineState } from "@/engine/core/runtime"

export function computeRegionalRiskDiagnostics(
  state: EngineState,
  requestedVolume: number
) {

  const signals: string[] = []

  const reserveFloor = 400

  for (const region of state.regions) {

    const afterTrade =
      region.availableKg - requestedVolume

    const ratio =
      region.capacityKg > 0
        ? region.availableKg / region.capacityKg
        : 0

    // =====================================================
    // CRITICAL RESERVE
    // =====================================================

    if (afterTrade < reserveFloor) {

      signals.push(
        `${region.name} reserve floor risk`
      )

    }

    // =====================================================
    // LOW SUPPLY
    // =====================================================

    else if (ratio < 0.25) {

      signals.push(
        `${region.name} low supply level`
      )

    }

    // =====================================================
    // STRUCTURAL PRESSURE
    // =====================================================

    else if (ratio < 0.4) {

      signals.push(
        `${region.name} supply pressure building`
      )

    }

  }

  return signals
}