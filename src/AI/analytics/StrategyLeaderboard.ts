// =====================================================
// STRATEGY LEADERBOARD ENGINE
//
// Ranking real de estrategias por performance.
//
// =====================================================

import { getTradeMemory } from "../learning/TradeMemory"

export type StrategyStats = {
  strategyId: string
  trades: number
  totalPnL: number
  avgPnL: number
}

// -----------------------------------------------------
// BUILD LEADERBOARD
// -----------------------------------------------------

export function computeStrategyLeaderboard(): StrategyStats[] {

  const trades = getTradeMemory()

  const map = new Map<string, StrategyStats>()

  for (const t of trades) {

    if (!t.strategyId) continue
    if (!t.isClosed) continue
    if (t.pnl === undefined) continue

    if (!map.has(t.strategyId)) {

      map.set(t.strategyId, {
        strategyId: t.strategyId,
        trades: 0,
        totalPnL: 0,
        avgPnL: 0
      })

    }

    const s = map.get(t.strategyId)!

    s.trades += 1
    s.totalPnL += t.pnl

  }

  // calcular avg
  map.forEach(s => {
    s.avgPnL = s.trades > 0
      ? s.totalPnL / s.trades
      : 0
  })

  // ordenar
  return Array.from(map.values())
    .sort((a, b) => b.totalPnL - a.totalPnL)

}