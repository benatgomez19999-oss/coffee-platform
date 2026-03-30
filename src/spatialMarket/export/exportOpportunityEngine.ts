// =====================================================
// EXPORT OPPORTUNITY ENGINE
//
// Escanea oportunidades de exportación entre regiones.
//
// Basado en:
//
// - diferencial de precios
// - volumen exportable
// - coste logístico
//
// Output:
//
// ExportOpportunity[]
// =====================================================

import type { RegionMarket } from "../registries/regionRegistry"
import type { SpatialPriceSurface } from "../pricing/spatialPriceEngine"
import type { CommodityFlow } from "../flows/commodityFlowEngine"



// =====================================================
// EXPORT OPPORTUNITY TYPE
// =====================================================

export type ExportOpportunity = {

  origin: string

  destination: string

  expectedMargin: number

  exportableVolume: number

  opportunityScore: number

}



// =====================================================
// OPPORTUNITY SCANNER
// =====================================================

export function computeExportOpportunities(

  regions: RegionMarket[],

  prices: SpatialPriceSurface,

  logistics: any

): ExportOpportunity[] {

  const opportunities: ExportOpportunity[] = []

  const friction =
    logistics?.globalFriction ?? 0

  const transportCostBase =
    logistics?.transportCostBase ?? 0


  for (const origin of regions) {

    const exportable =
      origin.exportableVolume ?? 0

    if (exportable <= 0) continue


    for (const destination of regions) {

      if (origin.name === destination.name)
        continue


      const originPrice =
        prices[origin.name] ?? 0

      const destinationPrice =
        prices[destination.name] ?? 0


      const priceSpread =
        destinationPrice - originPrice


      if (priceSpread <= 0)
        continue


      const transportCost =
        transportCostBase *
        (1 + friction)


      const margin =
        priceSpread - transportCost


      if (margin <= 0)
        continue


      // -------------------------------------------------
      // OPPORTUNITY SCORE
      // -------------------------------------------------

      const score =

        margin *
        (exportable / 1000)


      opportunities.push({

        origin: origin.name,

        destination: destination.name,

        expectedMargin: margin,

        exportableVolume: exportable,

        opportunityScore: score

      })

    }

  }


  // -------------------------------------------------
  // SORT BY BEST OPPORTUNITIES
  // -------------------------------------------------

  opportunities.sort(

    (a, b) =>
      b.opportunityScore -
      a.opportunityScore

  )

  return opportunities

}