// =====================================================
// COMMODITY SHOCK NETWORK
//
// Detecta propagación de shocks entre commodities.
//
// Modela dependencias estructurales entre mercados.
// =====================================================

import type { CommodityOpportunity }
from "@/src/AI/foresight/CommodityOpportunityScanner"

export type CommodityShock = {

  source: string
  target: string
  propagationStrength: number

}

export type CommodityShockSignal = {

  commodity: string
  shockPressure: number

}


// =====================================================
// DEPENDENCY GRAPH
//
// Relaciones estructurales entre commodities.
// =====================================================

const shockGraph: CommodityShock[] = [

  { source: "copper", target: "lithium", propagationStrength: 0.6 },
  { source: "oil", target: "wheat", propagationStrength: 0.4 },
  { source: "oil", target: "corn", propagationStrength: 0.4 },
  { source: "wheat", target: "corn", propagationStrength: 0.3 },
  { source: "nickel", target: "lithium", propagationStrength: 0.5 },
  { source: "copper", target: "aluminum", propagationStrength: 0.4 }

]


// =====================================================
// COMPUTE SHOCK PROPAGATION
// =====================================================

export function computeCommodityShockNetwork(

  opportunities: CommodityOpportunity[]

): CommodityShockSignal[] {

  const shocks: CommodityShockSignal[] = []

  const map =
    new Map(
      opportunities.map(o =>
        [o.commodity, o.opportunityScore]
      )
    )

  for (const edge of shockGraph) {

    const sourceScore =
      map.get(edge.source) ?? 0

    const propagation =
      sourceScore *
      edge.propagationStrength *
      0.01

    shocks.push({

      commodity: edge.target,

      shockPressure: propagation

    })

  }

  return shocks

}