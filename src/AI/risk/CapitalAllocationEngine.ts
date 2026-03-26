// =====================================================
// CAPITAL ALLOCATION ENGINE
//
// Gestiona cuánto capital asignar por trade.
//
// Inspirado en Kelly Criterion simplificado.
//
// =====================================================

import type { EngineState } from "@/engine/core/runtime"

// =====================================================
// MAIN FUNCTION
// =====================================================

export function computeCapitalAllocation(

  state: EngineState,

  expectedReturn: number,

  riskScore: number

): number {

  // -------------------------------------------------
  // NORMALIZE INPUTS
  // -------------------------------------------------

  const edge = expectedReturn / 100
  const risk = Math.max(0.01, riskScore)

  // -------------------------------------------------
  // KELLY FRACTION (SIMPLIFIED)
  // -------------------------------------------------

  const kelly =
    edge / risk

  // -------------------------------------------------
  // CLAMP (VERY IMPORTANT)
  // -------------------------------------------------

  const fraction =
    Math.max(0, Math.min(0.25, kelly))

  // -------------------------------------------------
  // SYSTEM CAPITAL (abstract)
  // -------------------------------------------------

  const baseCapital = 1000

  return baseCapital * fraction
}