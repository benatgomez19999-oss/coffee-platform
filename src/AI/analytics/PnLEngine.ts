// =====================================================
// PnL ENGINE
//
// Calcula profit & loss por trade.
//
// =====================================================

import type { EngineState } from "@/src/engine/core/runtime"

export function computePnL(
  state: EngineState
) {

  const transactions = state.transactions ?? []

  let totalPnL = 0

  for (const tx of transactions) {

    const marketPrice =
      state.spatialMarket?.prices?.[tx.region] ?? 1

    const pnl =
      tx.volume * (marketPrice - 1)

    totalPnL += pnl
  }

  return {
    totalPnL
  }

}