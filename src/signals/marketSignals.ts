// ============================================================
// MARKET SIGNAL LAYER
// ============================================================
//
// Convierte estado del mercado global en señales accionables.
//
// Este módulo NO tiene estado propio.
// Solo interpreta el market state.
//
// Produce:
// - señales de precio
// - señales de oferta
// - señales de demanda
// - señales de riesgo
//
// ============================================================

export type MarketSignalType =
  | "price_uptrend"
  | "price_downtrend"
  | "supply_shortage"
  | "demand_spike"
  | "cascade_risk"
  | "arbitrage_opportunity"

// ============================================================
// SIGNAL STRUCTURE
// ============================================================

export type MarketSignal = {
  type: MarketSignalType

  strength: number // 0 → 1

  origin?: string
  region?: string

  timestamp: number

  meta?: Record<string, any>
}

// ============================================================
// SIGNAL GENERATION
// ============================================================
//
// Input: global market state (temporalmente any)
// Output: lista de señales
//
// ============================================================

export function generateMarketSignals(
  state: any
): MarketSignal[] {

  const signals: MarketSignal[] = []

  // ============================================================
  // PRICE SIGNALS
  // ============================================================

  if (state?.price?.arabicaTrend > 0.05) {
    signals.push({
      type: "price_uptrend",
      strength: state.price.arabicaTrend,
      timestamp: state.tick
    })
  }

  if (state?.price?.arabicaTrend < -0.05) {
    signals.push({
      type: "price_downtrend",
      strength: Math.abs(state.price.arabicaTrend),
      timestamp: state.tick
    })
  }

  // ============================================================
  // SUPPLY SIGNALS
  // ============================================================

  if (state?.supply?.brazil < 0.7) {
    signals.push({
      type: "supply_shortage",
      strength: 1 - state.supply.brazil,
      origin: "Brazil",
      timestamp: state.tick
    })
  }

  // ============================================================
  // DEMAND SIGNALS
  // ============================================================

  if (state?.demand?.global > 1.1) {
    signals.push({
      type: "demand_spike",
      strength: state.demand.global - 1,
      timestamp: state.tick
    })
  }

  // ============================================================
  // RISK SIGNALS
  // ============================================================

  if (state?.risk?.cascadeProbability > 0.6) {
    signals.push({
      type: "cascade_risk",
      strength: state.risk.cascadeProbability,
      timestamp: state.tick
    })
  }

  return signals
}