// =====================================================
// REGION REGISTRY — PHYSICAL → MARKET TRANSFORMATION
//
// Convierte las regiones físicas del engine
// en regiones económicas del mercado.
//
// Fuente:
// state.regions
//
// Salida:
// RegionalMarket[]
// =====================================================

import type { EngineState } from "@/engine/core/runtime"


// =====================================================
// REGION MARKET TYPE
// =====================================================

export type RegionMarket = {

  name: string

  capacityKg: number

  availableKg: number

  utilization: number

  supplyStress: number

  exportableVolume: number

}



// =====================================================
// BUILD REGIONAL MARKETS
//
// Transforma el estado físico en estado económico.
// =====================================================

export function buildRegionalMarkets(
  state: EngineState
): RegionMarket[] {

  const regions = state.regions ?? []

  const markets: RegionMarket[] = []

  for (const r of regions) {

    const capacity =
      Math.max(1, r.capacityKg)

    const available =
      Math.max(0, r.availableKg)

    const utilization =
      1 - (available / capacity)

    const supplyStress =
      state.supplyStressField ?? 0


    // -------------------------------------------------
    // EXPORTABLE VOLUME
    //
    // Cantidad disponible para exportación
    // después de cubrir demanda local implícita
    // -------------------------------------------------

    const exportableVolume =
      Math.max(
        0,
        available -
        capacity * 0.3
      )


    markets.push({

      name: r.name,

      capacityKg: capacity,

      availableKg: available,

      utilization,

      supplyStress,

      exportableVolume

    })

  }

  return markets

}