// =====================================================
// COFFEE SUPPLY AI ADVISOR
//
// Genera recomendaciones estratégicas para la plataforma.
//
// Analiza:
//
// - estado del sistema (engine state)
// - portfolio de microlotes
// - señales del mercado
//
// Produce:
//
// - oportunidades de compra
// - riesgos de suministro
// - recomendaciones estratégicas
// =====================================================

import type { EngineState } from "@/engine/runtime"
import {
  analyzeMicroLotPortfolio
} from "@/clientLayer/microlots/microLotPortfolioEngine"
import {
  computeOriginDemandScore
} from "@/clientLayer/microlots/microLotMarketLearning"

import { getSignals } from "@/signals/signalRegistry"

export type CoffeeAdvisorInsight = {

  type:
    | "opportunity"
    | "risk"
    | "portfolio"
    | "client"

  message: string

}

// =====================================================
// MAIN ADVISOR ENGINE
// =====================================================

export function runCoffeeSupplyAdvisor(

  state: EngineState,

  portfolioLots: any[],

  marketLearning: any

): CoffeeAdvisorInsight[] {

  const insights: CoffeeAdvisorInsight[] = []

  // -----------------------------------------------------
  // SUPPLY RISK
  // -----------------------------------------------------

  const supplyStress =
    state.supplyStressField ?? 0

  if (supplyStress > 0.6) {

    insights.push({

      type: "risk",

      message:
        "Supply stress increasing across producing regions"

    })

  }

  // -----------------------------------------------------
  // PORTFOLIO ANALYSIS
  // -----------------------------------------------------

  const portfolioInsights =
    analyzeMicroLotPortfolio(
      portfolioLots,
      marketLearning
    )

  if (portfolioInsights.length > 0) {

    const bestLot =
      portfolioInsights[0]

    insights.push({

      type: "portfolio",

      message:
        `High margin opportunity detected for lot ${bestLot.microLotId}`

    })

  }

  // -----------------------------------------------------
  // ORIGIN DEMAND SIGNAL
  // -----------------------------------------------------

  const origins = [

    "Panama",
    "Ethiopia",
    "Colombia",
    "Kenya"

  ]

  for (const origin of origins) {

    const demand =
      computeOriginDemandScore(
        marketLearning,
        origin
      )

    if (demand > 45) {

      insights.push({

        type: "opportunity",

        message:
          `${origin} showing strong demand in recent trades`

      })

    }

  }

  // -----------------------------------------------------
  // CLIENT PREMIUM SIGNAL
  // -----------------------------------------------------

  const premiumClients = marketLearning.records.filter(
  (r: any) => r.event === "auction_win"
)

  if (premiumClients.length > 5) {

    insights.push({

      type: "client",

      message:
        "Multiple premium clients detected in recent auctions"

    })

  }

  // ============================================================
// MARKET SIGNALS
// ============================================================

const signals = getSignals()
const marketSignals = (signals as any).market ?? []

// ============================================================
// SIGNAL-DRIVEN INSIGHTS
// ============================================================

const signalInsights: CoffeeAdvisorInsight[] = []

// ------------------------------------------------------------
// SUPPLY SHORTAGE
// ------------------------------------------------------------

const shortage = marketSignals.find(
  (s: any) => s.type === "supply_shortage"
)

if (shortage) {

  signalInsights.push({
    type: "risk",
    message: `Supply shortage detected in ${shortage.origin}`,
  })

}

// ------------------------------------------------------------
// PRICE UPTREND
// ------------------------------------------------------------

const uptrend = marketSignals.find(
  (s: any) => s.type === "price_uptrend"
)

if (uptrend) {

  signalInsights.push({
    type: "opportunity",
    message: "Price uptrend detected — consider early procurement",
  })

}

// ------------------------------------------------------------
// DEMAND SPIKE
// ------------------------------------------------------------

const demandSpike = marketSignals.find(
  (s: any) => s.type === "demand_spike"
)

if (demandSpike) {

  signalInsights.push({
    type: "opportunity",
    message: "Demand spike detected — secure supply aggressively",
  })

}

// ------------------------------------------------------------
// CASCADE RISK
// ------------------------------------------------------------

const cascadeRisk = marketSignals.find(
  (s: any) => s.type === "cascade_risk"
)

if (cascadeRisk) {

  signalInsights.push({
    type: "risk",
    message: "Systemic cascade risk rising — reduce exposure",
  })

}

// ============================================================
// MERGE SIGNAL INSIGHTS INTO MAIN OUTPUT
// ============================================================

insights.push(...signalInsights)

  return insights

}

