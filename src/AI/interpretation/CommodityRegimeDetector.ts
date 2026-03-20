// =====================================================
// COMMODITY REGIME DETECTOR
//
// Detecta el régimen estructural del mercado
// de commodities basado en:
//
// - oportunidades
// - shocks propagados
// - fragilidad sistémica
// =====================================================

import type { CommodityOpportunity }
from "@/AI/foresight/CommodityOpportunityScanner"


export type CommodityRegime =

  | "stable-market"
  | "supply-crunch"
  | "demand-boom"
  | "logistics-shock"
  | "supercycle"


export function detectCommodityRegime(

  opportunities: CommodityOpportunity[],

  shocks: { commodity: string; shockPressure: number }[],

  systemFragility: number

): CommodityRegime {

  const avgOpportunity =
    opportunities.reduce(
      (s, o) => s + o.opportunityScore,
      0
    ) / Math.max(1, opportunities.length)


  const avgShock =
    shocks.reduce(
      (s, o) => s + o.shockPressure,
      0
    ) / Math.max(1, shocks.length)


  // -----------------------------------------------------
  // REGIME LOGIC
  // -----------------------------------------------------

  if (avgOpportunity > 120 && systemFragility > 0.6)
    return "supercycle"

  if (systemFragility > 0.55)
    return "supply-crunch"

  if (avgOpportunity > 100)
    return "demand-boom"

  if (avgShock > 5)
    return "logistics-shock"

  return "stable-market"

}