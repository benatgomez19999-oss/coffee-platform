// =====================================================
// COMMODITY STRATEGY ENGINE
//
// Convierte inteligencia del sistema en
// decisiones estratégicas sobre commodities.
// =====================================================

import type { CommodityOpportunity }
from "@/src/AI/foresight/CommodityOpportunityScanner"

import type { CommodityRegime }
from "@/src/AI/interpretation/CommodityRegimeDetector"


export type CommodityStrategy = {

  commodity: string
  action:

    | "enter"
    | "increase"
    | "hold"
    | "reduce"
    | "avoid"

  confidence: number

}



// =====================================================
// COMPUTE STRATEGY
// =====================================================

export function computeCommodityStrategy(

  opportunities: CommodityOpportunity[],
  regime: CommodityRegime,
  systemFragility: number

): CommodityStrategy[] {

  const strategies: CommodityStrategy[] = []

  for (const c of opportunities) {

    let action: CommodityStrategy["action"] = "hold"

    const score = c.opportunityScore

    // -------------------------------------------------
    // REGIME ADJUSTMENT
    // -------------------------------------------------

    if (regime === "supercycle") {

      if (score > 100) action = "enter"

      else if (score > 80) action = "increase"

      else action = "hold"

    }

    else if (regime === "supply-crunch") {

      if (score > 90) action = "increase"

      else if (score > 70) action = "hold"

      else action = "reduce"

    }

    else if (regime === "demand-boom") {

      if (score > 85) action = "enter"

      else if (score > 60) action = "increase"

      else action = "hold"

    }

    else if (regime === "logistics-shock") {

      action = "reduce"

    }

    else {

      if (score > 90) action = "enter"

      else if (score > 70) action = "increase"

      else if (score < 40) action = "avoid"

    }


    // -------------------------------------------------
    // CONFIDENCE
    // -------------------------------------------------

    const confidence =
      Math.max(
        0,
        Math.min(
          1,
          score / 120 - systemFragility * 0.3
        )
      )

    strategies.push({

      commodity: c.commodity,
      action,
      confidence

    })

  }

  return strategies

}