// =====================================================
// SUPPLY CHAIN STRESS SIMULATOR
//
// Simula disrupciones logísticas globales.
//
// Modela:
//
// - congestión portuaria
// - retrasos de shipping
// - restricciones comerciales
// - eventos climáticos
// =====================================================

import type { EngineState }
from "@/engine/core/runtime"


export type SupplyChainEvent = {

  type:

    | "port-congestion"
    | "shipping-delay"
    | "trade-restriction"
    | "weather-disruption"

  region: string

  severity: number

}



export function simulateSupplyChainStress(

  state: EngineState

): SupplyChainEvent[] {

  const events: SupplyChainEvent[] = []

  const regions =
    state.spatialMarket?.regions ?? []

  const globalStress =
    state.systemEnergy ?? 0


  for (const region of regions) {

    const random =
      Math.random()

    if (random < globalStress * 0.05) {

      events.push({

        type: "port-congestion",

        region: region.name,

        severity:
          Math.random() * globalStress

      })

    }

    if (random < globalStress * 0.03) {

      events.push({

        type: "shipping-delay",

        region: region.name,

        severity:
          Math.random() * globalStress

      })

    }

    if (random < globalStress * 0.02) {

      events.push({

        type: "trade-restriction",

        region: region.name,

        severity:
          Math.random() * globalStress

      })

    }

    if (random < globalStress * 0.04) {

      events.push({

        type: "weather-disruption",

        region: region.name,

        severity:
          Math.random() * globalStress

      })

    }

  }

  return events

}