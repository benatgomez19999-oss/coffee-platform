// =====================================================
// GLOBAL TRADE ROUTE OPTIMIZER
//
// Calcula las mejores rutas de exportación globales
// considerando:
//
// - precio regional
// - coste logístico
// - estrategia del sistema
// =====================================================

import type { EngineState }
from "@/engine/runtime"

export type TradeRoute = {

  commodity: string

  origin: string

  destination: string

  expectedMargin: number

  logisticsCost: number

}



export function optimizeTradeRoutes(

  state: EngineState

): TradeRoute[] {

  const routes: TradeRoute[] = []

  const strategies =
    state.commodityStrategies ?? []

  const regions =
    state.spatialMarket?.regions ?? []

  const logistics =
    state.spatialMarket?.logistics ?? {}


  for (const strategy of strategies) {

    if (
      strategy.action === "enter" ||
      strategy.action === "increase"
    ) {

      for (const origin of regions) {

        for (const destination of regions) {

          if (origin.name === destination.name)
            continue

          const originPrice =
            origin.prices?.[strategy.commodity] ?? 0

          const destPrice =
            destination.prices?.[strategy.commodity] ?? 0

          const logisticsCost =
            logistics?.costMatrix?.[
              origin.name
            ]?.[destination.name] ?? 10

          const margin =
            destPrice -
            originPrice -
            logisticsCost


          if (margin > 0) {

            routes.push({

              commodity:
                strategy.commodity,

              origin:
                origin.name,

              destination:
                destination.name,

              expectedMargin:
                margin,

              logisticsCost

            })

          }

        }

      }

    }

  }


  return routes.sort(

    (a, b) =>
      b.expectedMargin -
      a.expectedMargin

  )

}