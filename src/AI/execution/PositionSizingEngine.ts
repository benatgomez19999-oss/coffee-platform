// =====================================================
// POSITION SIZING ENGINE
//
// Calcula cuánto capital asignar a cada trade.
//
// Inputs:
//
// - strategy confidence
// - market signals
// - system risk
// - portfolio state
//
// Output:
//
// - volume multiplier (0 → 2x)
//
// =====================================================

import { getSignals } from "@/src/signals/signalRegistry"

import type { EngineState } from "@/src/engine/core/runtime"

// =====================================================
// MAIN FUNCTION
// =====================================================

export function computePositionSize(

  state: EngineState,

  baseVolume: number,

  confidence: number

): number {

  // =====================================================
  // BASE SIZE
  // =====================================================

  let size = baseVolume * confidence

  // =====================================================
  // MARKET SIGNALS
  // =====================================================

  const signals = getSignals()
  const marketSignals = (signals as any).market ?? []

  // -----------------------------------------------------
  // PRICE UPTREND → INCREASE SIZE
  // -----------------------------------------------------

  const uptrend = marketSignals.find(
    (s: any) => s.type === "price_uptrend"
  )

  if (uptrend) {

    size *= 1.2

  }

  // -----------------------------------------------------
  // SUPPLY SHORTAGE → AGGRESSIVE BUY
  // -----------------------------------------------------

  const shortage = marketSignals.find(
    (s: any) => s.type === "supply_shortage"
  )

  if (shortage) {

    size *= 1.3

  }

  // -----------------------------------------------------
  // CASCADE RISK → REDUCE SIZE
  // -----------------------------------------------------

  const cascadeRisk = marketSignals.find(
    (s: any) => s.type === "cascade_risk"
  )

  if (cascadeRisk) {

    size *= 0.5

  }

  // =====================================================
  // SYSTEM RISK CONTROL
  // =====================================================

  const fatiguePenalty =
    1 - state.systemFatigue

  size *= fatiguePenalty

  // =====================================================
  // HARD LIMITS
  // =====================================================

  const MIN = 50
  const MAX = 2000

  size = Math.max(MIN, Math.min(MAX, size))

  return size

}