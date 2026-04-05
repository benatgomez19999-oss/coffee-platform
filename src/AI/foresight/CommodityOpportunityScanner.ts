// =====================================================
// COMMODITY OPPORTUNITY SCANNER
//
// Evalúa oportunidades globales considerando:
//
// - señales estratégicas
// - mercado espacial
// - flujos comerciales
// - logística global
//
// =====================================================

import type { StrategicForecast } from "@/src/AI/foresight/StrategicForecastEngine"
import type { EngineState } from "@/src/engine/core/runtime"

export type CommodityInput = {

  name: string
  expectedPrice: number
  priceVolatility: number
  supplyStress: number
  demandGrowth: number

}

export type CommodityOpportunity = {

  commodity: string
  opportunityScore: number
  systemicRisk: number

}

export function scanCommodityOpportunities(

  commodities: CommodityInput[],
  strategic: StrategicForecast,
  state: EngineState

): CommodityOpportunity[] {

  const results: CommodityOpportunity[] = []

  const spatial = state.spatialMarket

  const logisticsPenalty =
    spatial?.logistics?.globalCongestion ?? 0

  const priceSurface =
    spatial?.prices ?? null

  for (const c of commodities) {

    // -------------------------------------------------
    // MARKET SIGNAL
    // -------------------------------------------------

    const priceSignal =
      priceSurface?.[c.name] ??
      c.expectedPrice

    // -------------------------------------------------
    // OPPORTUNITY CORE
    // -------------------------------------------------

    const opportunity =

      priceSignal * 0.35 +
      c.demandGrowth * 100 * 0.25 +
      c.supplyStress * 100 * 0.20 +
      strategic.strategicRisk * 100 * 0.20

    // -------------------------------------------------
    // SYSTEMIC RISK
    // -------------------------------------------------

    const risk =

      c.priceVolatility * 0.4 +
      logisticsPenalty * 0.3 +
      strategic.systemFragility * 0.3

    results.push({

      commodity: c.name,

      opportunityScore:
        Math.max(0, opportunity - risk * 100),

      systemicRisk: risk

    })

  }

  return results.sort(
    (a, b) =>
      b.opportunityScore - a.opportunityScore
  )

}