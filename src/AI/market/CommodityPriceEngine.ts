// =====================================================
// COMMODITY PRICE ENGINE
//
// Calcula precios dinámicos de commodities
// basados en el estado del sistema.
//
// Factores:
//
// - supply stress
// - shocks
// - demand growth
// - régimen de mercado
//
// =====================================================

import type { EngineState } from "@/engine/core/runtime"

export function updateCommodityPrices(

  state: EngineState

) {

  const shocks =
    state.commodityShockSignals ?? []

  const supplyStress =
    state.supplyStressField ?? 0

  const regime =
    state.commodityMarketRegime ?? "stable-market"


  const opportunities =
  state.commodityOpportunities ?? []



  const prices: Record<string, number> = {}


  for (const commodity of opportunities) {

    const basePrice =
      100 + commodity.opportunityScore * 80


    // ------------------------------------------------
    // SHOCK PRESSURE
    // ------------------------------------------------

    const shockSignal =
      shocks
        .filter(s => s.commodity === commodity.commodity)
        .reduce(
          (acc, s) => acc + s.shockPressure,
          0
        )


    // ------------------------------------------------
    // REGIME MULTIPLIER
    // ------------------------------------------------

    let regimeMultiplier = 1

    if (regime === "supply-crunch")
      regimeMultiplier = 1.2

    if (regime === "demand-boom")
      regimeMultiplier = 1.15

    if (regime === "logistics-shock")
      regimeMultiplier = 1.1

    if (regime === "supercycle")
      regimeMultiplier = 1.35


    // ------------------------------------------------
    // FINAL PRICE
    // ------------------------------------------------

    const price =

      basePrice *
      (1 + supplyStress * 0.5) *
      (1 + shockSignal * 0.3) *
      regimeMultiplier


    prices[commodity.commodity] =
      Math.max(10, price)
    

    

  }

  


// ------------------------------------------------
// WRITE TO STATE
// Fuerza nueva referencia para React
// ------------------------------------------------

state.spatialMarket = {

  ...(state.spatialMarket ?? {
    regions: [],
    flows: [],
    logistics: {},
    exportOpportunities: []
  }),

  prices

  

}
}