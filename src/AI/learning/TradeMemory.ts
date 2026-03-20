// =====================================================
// TRADE MEMORY
//
// Guarda histórico de trades + performance.
//
// =====================================================

type TradeRecord = {

  id: string

  commodity: string

  volume: number

  entryPrice: number

  // -------------------------------------------------
  // NEW (TRADE LIFECYCLE)
  // -------------------------------------------------

  exitPrice?: number

  pnl?: number

  strategyId?: string

  isClosed?: boolean

}

const memory: TradeRecord[] = []

export function recordTrade(trade: TradeRecord) {

  memory.push(trade)

  if (memory.length > 200) {
    memory.shift()
  }

}

export function getTradeMemory() {
  return memory
}