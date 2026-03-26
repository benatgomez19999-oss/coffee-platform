// =====================================================
// GLOBAL RISK DASHBOARD ENGINE
//
// Agrega señales del sistema para generar
// indicadores macro del estado global.
// =====================================================

import type { EngineState }
from "@/engine/core/runtime"

export type GlobalRiskDashboard = {

  globalSupplyStress: number
  logisticsDisruptionIndex: number
  commoditySupercycleProbability: number
  systemicRiskLevel: number
  portfolioFragility: number

}



export function computeGlobalRiskDashboard(

  state: EngineState

): GlobalRiskDashboard {

  const shocks =
    state.commodityShockSignals ?? []

  const supplyEvents =
    state.supplyChainEvents ?? []

  const portfolio =
    state.commodityPortfolio ?? []

  const fatigue =
    state.systemFatigue ?? 0


  // --------------------------------------------------
  // SUPPLY STRESS
  // --------------------------------------------------

  const globalSupplyStress =
    shocks.reduce(
      (s, o) => s + o.shockPressure,
      0
    ) / Math.max(1, shocks.length)


  // --------------------------------------------------
  // LOGISTICS DISRUPTION
  // --------------------------------------------------

  const logisticsDisruptionIndex =
    supplyEvents.reduce(
      (s, e) => s + e.severity,
      0
    ) / Math.max(1, supplyEvents.length)


  // --------------------------------------------------
  // PORTFOLIO FRAGILITY
  // --------------------------------------------------

  const portfolioFragility =
    portfolio.reduce(
      (s, p) => s + p.riskScore,
      0
    ) / Math.max(1, portfolio.length)


  // --------------------------------------------------
  // SUPERCYCLE PROBABILITY
  // --------------------------------------------------

  const commoditySupercycleProbability =
    Math.min(
      1,
      globalSupplyStress * 0.5 +
      portfolioFragility * 0.3 +
      fatigue * 0.2
    )


  // --------------------------------------------------
  // SYSTEMIC RISK
  // --------------------------------------------------

  const systemicRiskLevel =
    Math.min(
      1,
      logisticsDisruptionIndex * 0.4 +
      globalSupplyStress * 0.3 +
      fatigue * 0.3
    )


  return {

    globalSupplyStress,
    logisticsDisruptionIndex,
    commoditySupercycleProbability,
    systemicRiskLevel,
    portfolioFragility

  }

}