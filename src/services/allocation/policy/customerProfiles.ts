//////////////////////////////////////////////////////
// 🧠 CUSTOMER CONSUMPTION PROFILES (V0)
//
// IMPORTANT: These rows are CALIBRATION ASSUMPTIONS.
// They are NOT validated business truth.
//
// Every monthly volume, duration, bag size and SCA
// preference below is a placeholder until the founder
// confirms each row against real customer data.
//
// monthlyRoasted* values are ROASTED kg (client-facing
// commitment). The engine converts to GREEN using the
// lot's resolved roast yield before reserving supply.
//
// To override safely:
//   - export your own profile array
//   - pass a derived AllocationPolicy { contractProfiles: [...] }
//     to decideLotAllocation()
// Never mutate this array in place.
//////////////////////////////////////////////////////

import type { CustomerConsumptionProfile } from "../domain/types.ts"

export const CUSTOMER_CONSUMPTION_PROFILES_V0: ReadonlyArray<CustomerConsumptionProfile> = [
  {
    id: "small_specialty_cafe",
    label: "Small specialty café",
    monthlyRoastedKgMin: 30,
    monthlyRoastedKgTypical: 60,
    monthlyRoastedKgMax: 120,
    contractDurationMonthsTypical: 6,
    preferredBagSizeKg: 5,
    suitableForMicrolot: true,
    requiresSupplyContinuity: true,
    toleranceForSwitchingLots: "low",
    minScaScore: 84,
    priceSensitivity: "medium",
  },
  {
    id: "medium_cafe",
    label: "Medium café",
    monthlyRoastedKgMin: 120,
    monthlyRoastedKgTypical: 250,
    monthlyRoastedKgMax: 400,
    contractDurationMonthsTypical: 6,
    preferredBagSizeKg: 10,
    suitableForMicrolot: false,
    requiresSupplyContinuity: true,
    toleranceForSwitchingLots: "low",
    minScaScore: 83,
    priceSensitivity: "medium",
  },
  {
    id: "large_cafe",
    label: "Large café",
    monthlyRoastedKgMin: 400,
    monthlyRoastedKgTypical: 700,
    monthlyRoastedKgMax: 1200,
    contractDurationMonthsTypical: 12,
    preferredBagSizeKg: 20,
    suitableForMicrolot: false,
    requiresSupplyContinuity: true,
    toleranceForSwitchingLots: "very-low",
    minScaScore: 83,
    priceSensitivity: "medium",
  },
  {
    id: "restaurant",
    label: "Restaurant",
    monthlyRoastedKgMin: 20,
    monthlyRoastedKgTypical: 40,
    monthlyRoastedKgMax: 80,
    contractDurationMonthsTypical: 6,
    preferredBagSizeKg: 5,
    suitableForMicrolot: true,
    requiresSupplyContinuity: false,
    toleranceForSwitchingLots: "medium",
    minScaScore: 82,
    priceSensitivity: "low",
  },
  {
    id: "hotel",
    label: "Hotel",
    monthlyRoastedKgMin: 100,
    monthlyRoastedKgTypical: 200,
    monthlyRoastedKgMax: 400,
    contractDurationMonthsTypical: 12,
    preferredBagSizeKg: 10,
    suitableForMicrolot: false,
    requiresSupplyContinuity: true,
    toleranceForSwitchingLots: "low",
    minScaScore: 83,
    priceSensitivity: "medium",
  },
  {
    id: "office_corporate",
    label: "Office / corporate",
    monthlyRoastedKgMin: 30,
    monthlyRoastedKgTypical: 80,
    monthlyRoastedKgMax: 200,
    contractDurationMonthsTypical: 12,
    preferredBagSizeKg: 10,
    suitableForMicrolot: false,
    requiresSupplyContinuity: true,
    toleranceForSwitchingLots: "high",
    minScaScore: 80,
    priceSensitivity: "high",
  },
  {
    id: "small_roaster",
    label: "Small roaster",
    monthlyRoastedKgMin: 200,
    monthlyRoastedKgTypical: 500,
    monthlyRoastedKgMax: 1000,
    contractDurationMonthsTypical: 6,
    preferredBagSizeKg: 30,
    suitableForMicrolot: true,
    requiresSupplyContinuity: false,
    toleranceForSwitchingLots: "medium",
    minScaScore: 84,
    priceSensitivity: "medium",
  },
  {
    id: "medium_roaster",
    label: "Medium roaster",
    monthlyRoastedKgMin: 800,
    monthlyRoastedKgTypical: 1500,
    monthlyRoastedKgMax: 3000,
    contractDurationMonthsTypical: 12,
    preferredBagSizeKg: 60,
    suitableForMicrolot: false,
    requiresSupplyContinuity: true,
    toleranceForSwitchingLots: "low",
    minScaScore: 83,
    priceSensitivity: "medium",
  },
  {
    id: "high_volume_hospitality_group",
    label: "High-volume hospitality group",
    monthlyRoastedKgMin: 1500,
    monthlyRoastedKgTypical: 3000,
    monthlyRoastedKgMax: 6000,
    contractDurationMonthsTypical: 12,
    preferredBagSizeKg: 60,
    suitableForMicrolot: false,
    requiresSupplyContinuity: true,
    toleranceForSwitchingLots: "very-low",
    minScaScore: 82,
    priceSensitivity: "high",
  },
]
