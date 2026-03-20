// =====================================================
// REGION INVENTORY ENGINE
//
// Simula inventarios regionales de commodities.
//
// Permite:
//
// - absorción de shocks
// - acumulación de reservas
// - pánicos de inventario
//
// Esto genera:
//
// - price spikes realistas
// - ciclos de escasez
// - estabilidad temporal
// =====================================================

import type { EngineState }
from "@/engine/runtime"

import type { RegionMarket }
from "@/spatialMarket/regions/regionTypes"



export function updateRegionInventories(

  state: EngineState,
  regions: RegionMarket[]

) {

  for (const region of regions) {

    // ------------------------------------------------
    // INITIALIZE INVENTORY
    // ------------------------------------------------

    if (!region.inventory) {

      region.inventory =
        region.exportableVolume * 0.3

    }


    if (!region.inventoryCapacity) {

      region.inventoryCapacity =
        region.exportableVolume * 2

    }


    // ------------------------------------------------
    // SUPPLY INFLOW
    // ------------------------------------------------

    const inflow =
      region.exportableVolume * 0.05

    region.inventory += inflow


    // ------------------------------------------------
    // DEMAND DRAWDOWN
    // ------------------------------------------------

    const demand =
      region.localDemand ?? 0

    region.inventory -= demand * 0.03


    // ------------------------------------------------
    // CLAMP INVENTORY
    // ------------------------------------------------

    region.inventory = Math.max(
      0,
      Math.min(
        region.inventory,
        region.inventoryCapacity
      )
    )


    // ------------------------------------------------
    // INVENTORY STRESS
    // ------------------------------------------------

    region.inventoryStress =
      1 -
      region.inventory /
      region.inventoryCapacity

  }

}