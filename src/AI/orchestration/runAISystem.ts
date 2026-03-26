// =====================================================
// AI SYSTEM ORCHESTRATOR
//
// Ejecuta toda la capa de inteligencia artificial
// en orden correcto.
//
// Pipeline:
//
// sensing
// ↓
// system interpretation
// ↓
// predictive simulation
// ↓
// strategic forecast
// ↓
// updateEngineContext
//
// =====================================================

import { updateEngineContext } from "@/engine/core/runtime"

import { computeWeatherSignal } from "@/AI/sensing/WeatherIntelligence"
import { computeDemandSignal } from "@/AI/sensing/DemandIntelligence"
import { computeSupplyRiskSignal } from "@/AI/sensing/SupplyRiskIntelligence"

import { computeAISystemSignals } from "@/AI/interpretation/systemIntelligence"

import { runMonteCarloForecast } from "@/AI/foresight/predictiveSimulation"
import { computeStrategicForecast } from "@/AI/foresight/StrategicForecastEngine"
import type { StrategicForecast }
from "@/AI/foresight/StrategicForecastEngine"

import type { EngineState, EngineContext } from "@/engine/core/runtime"

import type { WeatherInput } from "@/AI/sensing/WeatherIntelligence"
import type { DemandInput } from "@/AI/sensing/DemandIntelligence"
import type { SupplyRiskInput } from "@/AI/sensing/SupplyRiskIntelligence"
import { runDecisionStressTest } from "@/AI/foresight/DecisionStressTest"
import { scanCommodityOpportunities }
from "@/AI/foresight/CommodityOpportunityScanner"
import { computeCommodityShockNetwork }
from "@/AI/foresight/CommodityShockNetwork"
import { detectCommodityRegime }
from "@/AI/interpretation/CommodityRegimeDetector"
import { computeCommodityStrategy }
from "@/AI/decision/CommodityStrategyEngine"
import { optimizeTradeRoutes }
from "@/AI/decision/GlobalTradeRouteOptimizer"
import { simulateSupplyChainStress }
from "@/AI/simulation/SupplyChainStressSimulator"
import { optimizeCommodityPortfolio }
from "@/AI/decision/GlobalCommodityPortfolioOptimizer"
import { computeGlobalRiskDashboard }
from "@/AI/dashboard/GlobalRiskDashboardEngine"
import { applyGlobalScenario }
from "@/AI/simulation/GlobalScenarioEngine"
import { generateStrategicInsights }
from "@/AI/advisor/AIStrategicAdvisor"
import { runAutonomousStrategyAgent }
from "@/AI/agent/AutonomousStrategyAgent"
import { updateCommodityPrices }
from "@/AI/market/CommodityPriceEngine"
import { getSignals } from "@/signals/signalRegistry"
import { runPortfolioRebalancer }
from "@/AI/risk/PortfolioRebalancer"
import { computeStrategyAdjustment }
from "@/AI/learning/StrategyLearningEngine"
import { evolveStrategies }
from "@/AI/evolution/StrategyEvolutionEngine"
import { closeTrades }
from "@/AI/analytics/TradeClosureEngine"
import { computeStrategyLeaderboard }
from "@/AI/analytics/StrategyLeaderboard"


// =====================================================
// AI INPUT
//
// Datos externos alimentando la inteligencia.
//
// =====================================================

export type AIInput = {

  weather: WeatherInput
  demand: DemandInput
  supply: SupplyRiskInput

}


// =====================================================
// RUN AI SYSTEM
//
// Ejecuta toda la capa AI y actualiza EngineContext.
//
// =====================================================

export function runAISystem(

  state: EngineState,
  context: EngineContext,
  input: AIInput

) {

  // -----------------------------------------------------
  // SENSING LAYER
  // -----------------------------------------------------

  const weatherSignal =
    computeWeatherSignal(input.weather)

  const demandSignal =
    computeDemandSignal(input.demand)

  const supplySignal =
    computeSupplyRiskSignal(input.supply)


  // -----------------------------------------------------
  // SYSTEM INTERPRETATION
  // -----------------------------------------------------

  const aiSignals =
    computeAISystemSignals(
      weatherSignal,
      demandSignal,
      supplySignal
    )


  // -----------------------------------------------------
// ADAPTIVE FORECAST TRIGGER
// Monte Carlo solo cuando el sistema entra en zona crítica
// -----------------------------------------------------

let forecast = null

if (
  state.collapseProximity > 0.35 ||
  state.criticalSlowing > 0.4
) {

  forecast =
    runMonteCarloForecast(
      state,
      context,
      {
        simulations: 200,
        horizonSeconds: 120,
        dt: 1 / 60
      }
    )

}

// -----------------------------------------------------
// STRATEGIC FORECAST
//
// Interpretación estratégica del forecast Monte Carlo.
// -----------------------------------------------------

let strategic: StrategicForecast = {

  strategicRisk: 0,
  interventionUrgency: 0,
  decisionRobustness: 1,
  systemFragility: 0,

  systemStability: 1,
  strategicConfidence: 1,

  marketRegime: "stable" 

}

if (forecast) {

  strategic =
    computeStrategicForecast(
      forecast
    )

}

// -----------------------------------------------------
// COMMODITY OPPORTUNITY SCANNER
// -----------------------------------------------------

const commodityUniverse = [
  { name: "coffee", expectedPrice: 120, priceVolatility: 0.25, supplyStress: 0.45, demandGrowth: 0.35 },
  { name: "cocoa", expectedPrice: 140, priceVolatility: 0.28, supplyStress: 0.42, demandGrowth: 0.32 },
  { name: "copper", expectedPrice: 160, priceVolatility: 0.22, supplyStress: 0.30, demandGrowth: 0.50 },
  { name: "lithium", expectedPrice: 180, priceVolatility: 0.30, supplyStress: 0.35, demandGrowth: 0.55 },
  { name: "wheat", expectedPrice: 100, priceVolatility: 0.18, supplyStress: 0.25, demandGrowth: 0.20 },
  { name: "soy", expectedPrice: 110, priceVolatility: 0.20, supplyStress: 0.28, demandGrowth: 0.22 },
  { name: "nickel", expectedPrice: 150, priceVolatility: 0.26, supplyStress: 0.33, demandGrowth: 0.40 },
  { name: "sugar", expectedPrice: 90, priceVolatility: 0.21, supplyStress: 0.24, demandGrowth: 0.18 },
  { name: "aluminum", expectedPrice: 130, priceVolatility: 0.23, supplyStress: 0.29, demandGrowth: 0.34 },
  { name: "corn", expectedPrice: 95, priceVolatility: 0.19, supplyStress: 0.27, demandGrowth: 0.21 }
]

const commodityOpportunities = commodityUniverse.map(c => ({
  commodity: c.name,
  opportunityScore: Math.random(),
  systemicRisk: Math.random()
}))

state.commodityOpportunities =
  commodityOpportunities





// -----------------------------------------------------
// COMMODITY SHOCK NETWORK
//
// Detecta propagación de shocks entre commodities
// -----------------------------------------------------

const commodityShocks =
  computeCommodityShockNetwork(
    commodityOpportunities
  )

state.commodityShockSignals =
  commodityShocks

// -----------------------------------------------------
// COMMODITY REGIME DETECTOR
// -----------------------------------------------------

const commodityRegime =
  detectCommodityRegime(

    commodityOpportunities,
    commodityShocks,
    strategic.systemFragility

  )

state.commodityMarketRegime =
  commodityRegime

// -----------------------------------------------------
// COMMODITY STRATEGY ENGINE
// -----------------------------------------------------

const commodityStrategies =
  computeCommodityStrategy(

    commodityOpportunities,
    commodityRegime,
    strategic.systemFragility

  )

state.commodityStrategies =
  commodityStrategies

// -----------------------------------------------------
// KILL WEAK STRATEGIES
// -----------------------------------------------------

state.commodityStrategies =
  (state.commodityStrategies ?? []).filter(s => {

    // sin fitness → mantener (nuevas)
    if (s.fitness === undefined) return true

    // eliminar si muy mala
    return s.fitness > -0.2

  })

  

// -----------------------------------------------------
// EVOLUTIONARY STRATEGIES
// -----------------------------------------------------

const evolved = evolveStrategies()

const evolvedStrategies = evolved.map(g => ({

  // -------------------------------------------------
  // IDENTITY
  // -------------------------------------------------

  id: g.id,

  source: "evolution" as const,

  // -------------------------------------------------
  // CORE STRATEGY
  // -------------------------------------------------

  commodity: g.commodity,

  action:
    (g.aggressiveness > 0.6
      ? "enter"
      : "hold") as "enter" | "hold",

  confidence: g.aggressiveness,

  // -------------------------------------------------
  // PERFORMANCE
  // -------------------------------------------------

  fitness: g.fitness,

  // -------------------------------------------------
  // CAPITAL
  // -------------------------------------------------

  capitalWeight: 0

}))

// SAFE MERGE (NO TYPE BREAK)

state.commodityStrategies = [
  ...(state.commodityStrategies ?? []),
  ...evolvedStrategies
]

  

// -----------------------------------------------------
// STRATEGY LEARNING ADJUSTMENT
// -----------------------------------------------------

const adjustment =
  computeStrategyAdjustment()

state.commodityStrategies =
  (state.commodityStrategies ?? []).map(strategy => ({

    ...strategy,

    confidence: Math.max(
      0,
      Math.min(
        1,
        (strategy.confidence ?? 0.5) + adjustment
      )
    )

  }))

// ============================================================
// MARKET SIGNAL ADJUSTMENT LAYER
//
// Ajusta estrategias en base a señales del mercado.
// No reemplaza el strategy engine — lo refina.
//
// ============================================================

const signals = getSignals()
const marketSignals = (signals as any).market ?? []

// ------------------------------------------------------------
// SUPPLY SHORTAGE → BOOST ENTRY CONFIDENCE
// ------------------------------------------------------------

const shortage = marketSignals.find(
  (s: any) => s.type === "supply_shortage"
)

if (shortage) {

  state.commodityStrategies =
    (state.commodityStrategies ?? []).map(strategy => ({

      ...strategy,

      confidence: Math.min(
        1,
        (strategy.confidence ?? 0.5) + 0.2
      )

    }))

}

// ------------------------------------------------------------
// PRICE UPTREND → FAVOR ENTRY
// ------------------------------------------------------------

const uptrend = marketSignals.find(
  (s: any) => s.type === "price_uptrend"
)

if (uptrend) {

  state.commodityStrategies =
    (state.commodityStrategies ?? []).map(strategy => ({

      ...strategy,

      action:
        strategy.action === "hold"
          ? "enter"
          : strategy.action

    }))

}

// ------------------------------------------------------------
// CASCADE RISK → REDUCE EXPOSURE
// ------------------------------------------------------------

const cascadeRisk = marketSignals.find(
  (s: any) => s.type === "cascade_risk"
)

if (cascadeRisk) {

  state.commodityStrategies =
    (state.commodityStrategies ?? []).map(strategy => ({

      ...strategy,

      action: "reduce",

      confidence: Math.min(
        strategy.confidence ?? 0.5,
        0.6
      )

    }))

}

// -----------------------------------------------------
// COMMODITY PRICE ENGINE
// -----------------------------------------------------

updateCommodityPrices(state)

// -----------------------------------------------------
// GLOBAL TRADE ROUTE OPTIMIZER
// -----------------------------------------------------

const tradeRoutes =
  optimizeTradeRoutes(state)

state.globalTradeRoutes =
  tradeRoutes

// -----------------------------------------------------
// SUPPLY CHAIN STRESS SIMULATOR
// -----------------------------------------------------

const supplyChainEvents =
  simulateSupplyChainStress(state)

state.supplyChainEvents =
  supplyChainEvents

// -----------------------------------------------------
// GLOBAL COMMODITY PORTFOLIO OPTIMIZER
// -----------------------------------------------------

const portfolioAllocation =
  optimizeCommodityPortfolio(state)

state.commodityPortfolio =
  portfolioAllocation

// -----------------------------------------------------
// GLOBAL RISK DASHBOARD
// -----------------------------------------------------

const riskDashboard =
  computeGlobalRiskDashboard(state)

state.globalRiskDashboard =
  riskDashboard

// -----------------------------------------------------
// GLOBAL SCENARIO ENGINE
// -----------------------------------------------------

if (state.activeScenario) {

  applyGlobalScenario(
    state,
    state.activeScenario
  )

}

// -----------------------------------------------------
// AI STRATEGIC ADVISOR
// -----------------------------------------------------

const strategicInsights =
  generateStrategicInsights(state)

state.strategicInsights =
  strategicInsights

// -----------------------------------------------------
// AUTONOMOUS STRATEGY AGENT
// -----------------------------------------------------

runAutonomousStrategyAgent(state, context)

// -----------------------------------------------------
// TRADE CLOSURE (REAL PnL GENERATION)
// -----------------------------------------------------

closeTrades(
  Object.fromEntries(
    (state.commodityOpportunities ?? []).map(c => [
      c.commodity,
      c.opportunityScore * 100 // proxy de precio
    ])
  )
)

// -----------------------------------------------------
// STRATEGY LEADERBOARD (REAL PnL)
// -----------------------------------------------------

const leaderboard =
  computeStrategyLeaderboard()

// -----------------------------------------------------
// KILL STRATEGIES BY REAL PnL
// -----------------------------------------------------

const badStrategies = new Set(

  leaderboard
    .filter(s =>
      s.trades > 3 &&      // evitar ruido
      s.totalPnL < 0       // pierde dinero real
    )
    .map(s => s.strategyId)

)

state.commodityStrategies =
  (state.commodityStrategies ?? []).filter(s => {

    if (!s.id) return true

    return !badStrategies.has(s.id)

  })

// -----------------------------------------------------
// BOOST WINNERS (REAL PnL)
// -----------------------------------------------------

const winners = new Set(

  leaderboard
    .filter(s =>
      s.trades > 3 &&
      s.totalPnL > 0
    )
    .map(s => s.strategyId)

)

state.commodityStrategies =
  (state.commodityStrategies ?? []).map(s => {

    if (!s.id) return s

    if (winners.has(s.id)) {

      return {
        ...s,
        confidence: Math.min(1, s.confidence * 1.2)
      }

    }

    return s

  })

// -----------------------------------------------------
// PORTFOLIO REBALANCER
// -----------------------------------------------------

runPortfolioRebalancer(state)


  // -----------------------------------------------------
  // DECISION STRESS TEST
  // -----------------------------------------------------

const stress =
  runDecisionStressTest(state, context)


  // -----------------------------------------------------
  // UPDATE ENGINE CONTEXT
  // -----------------------------------------------------

 updateEngineContext({

  scenarioField: aiSignals.scenarioField,
  anticipatoryBuffer: aiSignals.anticipatoryBuffer,
  predictiveHorizon: aiSignals.predictiveHorizon,
  meaningField: aiSignals.meaningField,
  counterfactualSignal: aiSignals.counterfactualSignal,

  // -------------------------------------------------
  // STRATEGIC FORECAST SIGNALS
  // -------------------------------------------------

  strategicRisk: strategic.strategicRisk,
  interventionUrgency: strategic.interventionUrgency,
  systemFragility: strategic.systemFragility,

  systemStability: strategic.systemStability,
  strategicConfidence: strategic.strategicConfidence,
  marketRegime: strategic.marketRegime,

  // -------------------------------------------------
  // DECISION ROBUSTNESS
  // -------------------------------------------------

  decisionRobustness:
    Math.min(
      stress.decisionRobustness,
      strategic.decisionRobustness
    )

})

}