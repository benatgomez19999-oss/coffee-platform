// =====================================================
// STRATEGY LEARNING ENGINE
//
// Ajusta confianza de estrategias según performance.
//
// =====================================================

import { getTradeMemory } from "@/src/AI/learning/TradeMemory"

export function computeStrategyAdjustment() {

  const memory = getTradeMemory()

  if (!memory.length) return 0

const closedTrades =
  memory.filter(t => t.isClosed && t.pnl !== undefined)

if (!closedTrades.length) return 0

const avgPnL =
  closedTrades.reduce(
    (sum, t) => sum + (t.pnl ?? 0),
    0
  ) / closedTrades.length

if (avgPnL > 0) return 0.1
if (avgPnL < 0) return -0.1

return 0
}