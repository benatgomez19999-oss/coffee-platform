// =====================================================
// COMMODITY FLOW ENGINE
//
// Calcula los flujos globales de commodities
// entre regiones.
//
// Basado en:
//
// - excedente exportable
// - diferencia de precios
// - fricción logística
//
// Output:
//
// CommodityFlow[]
// =====================================================

import type { RegionMarket }
from "@/spatialMarket/regions/regionTypes"
import type { SpatialPriceSurface } from "../pricing/spatialPriceEngine"



// =====================================================
// FLOW TYPE
// =====================================================

export type CommodityFlow = {

  from: string

  to: string

  volume: number

  margin: number

}



// =====================================================
// FLOW COMPUTATION
// =====================================================

export function computeCommodityFlows(

  regions: RegionMarket[],

  logistics: any,

  prices: SpatialPriceSurface

): CommodityFlow[] {

  const flows: CommodityFlow[] = []

  const friction =
    logistics?.globalFriction ?? 0


  for (const origin of regions) {

    const supply =
      origin.exportableVolume ?? 0

    if (supply <= 0) continue


    for (const destination of regions) {

      if (origin.name === destination.name)
        continue


      const originPrice =
        prices[origin.name] ?? 0

      const destinationPrice =
        prices[destination.name] ?? 0


      const priceSpread =
        destinationPrice - originPrice


      // -------------------------------------------------
      // NO TRADE IF NOT PROFITABLE
      // -------------------------------------------------

      if (priceSpread <= 0) continue


      // -------------------------------------------------
      // LOGISTICS COST
      // -------------------------------------------------

      const transportCost =
        (logistics?.transportCostBase ?? 0)
        * (1 + friction)


      const margin =
        priceSpread - transportCost


      if (margin <= 0) continue


      // -------------------------------------------------
      // TRADE VOLUME MODEL
      // -------------------------------------------------

      const volume =
        supply * 0.3 *
        (margin / 100)


      if (volume <= 0) continue


      flows.push({

        from: origin.name,

        to: destination.name,

        volume,

        margin

      })

    }

  }

  return flows

}