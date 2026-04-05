import { getTradeMemory } from "@/src/AI/learning/TradeMemory"

export function closeTrades(currentPriceMap: Record<string, number>) {

  const trades = getTradeMemory()

  for (const trade of trades) {

    if (trade.isClosed) continue

    const marketPrice =
      currentPriceMap[trade.commodity]

    if (!marketPrice) continue

    // -------------------------------------------------
    // SIMPLE EXIT LOGIC (puedes mejorar luego)
    // -------------------------------------------------

    const shouldClose =
      Math.random() > 0.7 // placeholder

    if (!shouldClose) continue

    trade.exitPrice = marketPrice

    trade.pnl =
      (marketPrice - trade.entryPrice) *
      trade.volume

    trade.isClosed = true

  }

}