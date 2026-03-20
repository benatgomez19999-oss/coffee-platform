// =====================================================
// REGION MARKET TYPE
// =====================================================

export type RegionMarket = {

  name: string

  exportableVolume: number

  utilization: number

  supplyStress: number

  // -------------------------------------------------
  // INVENTORY SYSTEM
  // -------------------------------------------------

  inventory?: number

  inventoryCapacity?: number

  inventoryStress?: number

  // -------------------------------------------------
  // DEMAND
  // -------------------------------------------------

  localDemand?: number

}