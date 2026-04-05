// =====================================================
// AI STRATEGIC ADVISOR
//
// Genera insights estratégicos comprensibles
// basados en el estado global del sistema.
//
// =====================================================

import type { EngineState }
from "@/src/engine/core/runtime"

export type StrategicInsight = {

  type:

    | "opportunity"
    | "risk"
    | "logistics"
    | "portfolio"

  message: string

}



export function generateStrategicInsights(

  state: EngineState

): StrategicInsight[] {

  const insights: StrategicInsight[] = []


  const opportunities =
    state.commodityOpportunities ?? []

  const shocks =
    state.commodityShockSignals ?? []

  const risk =
    state.globalRiskDashboard


  const portfolio =
    state.commodityPortfolio ?? []


  // -------------------------------------------------
  // OPPORTUNITY INSIGHTS
  // -------------------------------------------------

  const topOpportunity =
    opportunities[0]

  if (topOpportunity) {

    insights.push({

      type: "opportunity",

      message:
        `High opportunity detected in ${topOpportunity.commodity} markets.`

    })

  }


  // -------------------------------------------------
  // SHOCK INSIGHTS
  // -------------------------------------------------

  const highShock =
    shocks.find(
      s => s.shockPressure > 5
    )

  if (highShock) {

    insights.push({

      type: "risk",

      message:
        `Shock propagation detected affecting ${highShock.commodity}.`

    })

  }


  // -------------------------------------------------
  // LOGISTICS INSIGHTS
  // -------------------------------------------------

  if (
    risk &&
    risk.logisticsDisruptionIndex > 0.4
  ) {

    insights.push({

      type: "logistics",

      message:
        "Significant logistics disruption detected in global supply chains."

    })

  }


  // -------------------------------------------------
  // PORTFOLIO INSIGHTS
  // -------------------------------------------------

  const dominant =
    portfolio[0]

  if (dominant) {

    insights.push({

      type: "portfolio",

      message:
        `Portfolio currently concentrated in ${dominant.commodity}.`

    })

  }


  return insights

}