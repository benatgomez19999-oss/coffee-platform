// =====================================================
// AUTONOMOUS STRATEGY AGENT
//
// Ejecuta decisiones automáticamente cuando
// el modo autónomo está habilitado.
//
// =====================================================

import type { EngineState, EngineContext }
from "@/engine/core/runtime"

import { submitOperationalRequest }
from "@/engine/core/runtime"

import { selectBestTradeRoute }
from "@/AI/execution/selectBestTradeRoute"

import { evaluateExecutionRisk }
from "@/AI/execution/ExecutionRiskEngine"

import { applyMarketImpact }
from "@/AI/execution/MarketImpactEngine"

import { computePositionSize }
from "@/AI/execution/PositionSizingEngine"

import { applyExposureConstraint }
from "@/AI/risk/PortfolioExposureEngine"

import { computeCapitalAllocation }
from "@/AI/risk/CapitalAllocationEngine"

import { getCapitalWeight }
from "@/AI/evolution/CapitalCompetitionEngine"

import { recordTrade }
from "@/AI/learning/TradeMemory"



export function runAutonomousStrategyAgent(

  state: EngineState,
  context: EngineContext

) {

  // ------------------------------------------------
  // AGENT ENABLED?
  // ------------------------------------------------

  if (!context.autonomousMode) return

  // ------------------------------------------------
  // SYSTEM INSTABILITY GUARD
  // ------------------------------------------------

  if (state.systemFatigue > 0.8) return

  const strategies =
    state.commodityStrategies ?? []

  for (const strategy of strategies) {

    console.log("STRATEGY CHECK", {
  commodity: strategy.commodity,
  action: strategy.action,
  confidence: strategy.confidence
})

    // =====================================================
    // ENTRY STRATEGY ONLY
    // =====================================================

    if (strategy.action !== "enter") continue

    // ------------------------------------------------
    // MARKET REGIME FILTER
    // ------------------------------------------------

    if (state.commodityMarketRegime === "logistics-shock") {

      console.log("AUTO: trade blocked (logistics shock)")
      continue

    }

    // ------------------------------------------------
    // SELECT BEST TRADE ROUTE
    // ------------------------------------------------

    const route =
      selectBestTradeRoute(
        state,
        strategy.commodity
      )

    if (!route) continue

    // ------------------------------------------------
    // CASCADE RISK FILTER
    // ------------------------------------------------

    const cascade =
      state.spatialMarket?.cascadeStress?.[
        route.destination
      ] ?? 0

    if (cascade > 0.7) {

      console.log(
        "AUTO: trade blocked (regional cascade risk)"
      )

      continue
    }

    // ------------------------------------------------
    // EXECUTION RISK ENGINE
    // ------------------------------------------------

    const decision =
      evaluateExecutionRisk(
        state,
        route.expectedMargin
      )

    if (decision.action === "cancel") {
      console.log("AUTO: trade cancelled (risk too high)")
      continue
    }

    if (decision.action === "delay") {
      console.log("AUTO: delaying trade")
      continue
    }

    // ------------------------------------------------
    // POSITION SIZING ENGINE
    // ------------------------------------------------

    const baseVolume = 400

    let volume =
      computePositionSize(
        state,
        baseVolume,
        strategy.confidence ?? 0.5
      )

    if (volume < 10) continue

    // ------------------------------------------------
    // CAPITAL WEIGHT (FROM EVOLUTION ENGINE)
    // ------------------------------------------------

    const capitalWeight =
      getCapitalWeight(strategy.id ?? "")

    strategy.capitalWeight = capitalWeight

    const safeWeight =
      capitalWeight > 0 ? capitalWeight : 0.2

    volume =
      volume * safeWeight

    // ------------------------------------------------
    // SUPPLY-CRUNCH ADJUSTMENT
    // ------------------------------------------------

    if (state.commodityMarketRegime === "supply-crunch") {
      volume *= 0.5
    }

    // ------------------------------------------------
    // PORTFOLIO EXPOSURE CONTROL
    // ------------------------------------------------

    volume =
      applyExposureConstraint(
        state,
        strategy.commodity,
        volume
      )

    // ------------------------------------------------
    // CAPITAL ALLOCATION (KELLY-LIKE)
    // ------------------------------------------------

    const capital =
      computeCapitalAllocation(
        state,
        route.expectedMargin,
        decision.riskScore
      )

    volume =
      Math.min(volume, capital)

    // ------------------------------------------------
    // FINAL RISK ADJUSTMENT
    // ------------------------------------------------

    volume =
      volume *
      decision.volumeMultiplier

    if (volume < 50) continue

    // ------------------------------------------------
    // EXECUTION LOG
    // ------------------------------------------------

    console.log(

`AUTO TRADE EXECUTION

commodity: ${route.commodity}
origin: ${route.origin}
destination: ${route.destination}

margin: ${route.expectedMargin}
riskScore: ${decision.riskScore}

volume: ${Math.round(volume)}kg`

    )

    // ------------------------------------------------
    // OPERATIONAL EXECUTION
    // ------------------------------------------------

    submitOperationalRequest(
      Math.round(volume),
      "manual"
    )

    // ------------------------------------------------
    // MARKET IMPACT
    // ------------------------------------------------

    applyMarketImpact(
      state,
      route.commodity,
      volume
    )

    // ------------------------------------------------
    // TRADE MEMORY (ENTRY ONLY)
    // ------------------------------------------------

    recordTrade({

      id: Math.random().toString(36).slice(2),

      commodity: route.commodity,

      volume: Math.round(volume),

      entryPrice: route.expectedMargin,

      strategyId: strategy.id

    })

 

  }

}