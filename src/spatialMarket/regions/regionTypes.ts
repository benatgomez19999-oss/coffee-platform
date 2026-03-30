// =====================================================
// REGION MARKET TYPE
// =====================================================

export type RegionMarket = {

  name: string

  // 🔥 CORE SUPPLY
  capacityKg: number
  availableKg: number

  // 📊 MARKET SIGNALS
  exportableVolume: number
  utilization: number
  supplyStress: number

  // 📦 INVENTORY SYSTEM
  inventory?: number
  inventoryCapacity?: number
  inventoryStress?: number

  // 📈 DEMAND
  localDemand?: number

}