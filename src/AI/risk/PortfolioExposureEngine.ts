// =====================================================
// PORTFOLIO EXPOSURE ENGINE
//
// Controla sobreexposición por commodity/origen.
//
// Evita concentración excesiva.
//
// =====================================================

import type { EngineState } from "@/engine/runtime"

// =====================================================
// COMPUTE EXPOSURE
// =====================================================

export function computeCommodityExposure(

  state: EngineState,
  commodity: string

): number {

  const portfolio = state.commodityPortfolio ?? []

  const position = portfolio.find(
    p => p.commodity === commodity
  )

  return position?.weight ?? 0
}

// =====================================================
// APPLY EXPOSURE CONSTRAINT
// =====================================================

export function applyExposureConstraint(

  state: EngineState,

  commodity: string,

  volume: number

): number {

  const exposure =
    computeCommodityExposure(state, commodity)

  // -------------------------------------------------
  // HARD LIMITS
  // -------------------------------------------------

  if (exposure > 0.4) {
    return volume * 0.5
  }

  if (exposure > 0.6) {
    return volume * 0.2
  }

  return volume
}