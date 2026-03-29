//////////////////////////////////////////////////////
// 🌍 DESTINATION COST ENGINE
//////////////////////////////////////////////////////

type DestinationCostsInput = {
  importCostPerKg?: number
  transportToRoasterPerKg?: number
  roastingCostPerKg?: number
  packagingCostPerKg?: number
  lastMilePerKg?: number
}

export function calculateDestinationCosts(input: DestinationCostsInput) {
  const {
    importCostPerKg = 0.2,
    transportToRoasterPerKg = 0.08,
    roastingCostPerKg = 5,
    packagingCostPerKg = 1.5,
    lastMilePerKg = 0.5,
  } = input

  const total =
    importCostPerKg +
    transportToRoasterPerKg +
    roastingCostPerKg +
    packagingCostPerKg +
    lastMilePerKg

  return {
    total,
    breakdown: {
      import: importCostPerKg,
      transport: transportToRoasterPerKg,
      roasting: roastingCostPerKg,
      packaging: packagingCostPerKg,
      lastMile: lastMilePerKg,
    },
  }
}