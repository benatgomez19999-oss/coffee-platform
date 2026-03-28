//////////////////////////////////////////////////////
// 🧠 PRICING ENGINE (CLIENT)
//////////////////////////////////////////////////////

import { BASE_PRICING, ALTITUDE_MODIFIER } from "./pricingTable"

type ProcessType = "WASHED" | "NATURAL" | "HONEY" | "ANAEROBIC"

type Variety =
  | "CASTILLO"
  | "CATURRA"
  | "COLOMBIA"
  | "TYPICA"
  | "BOURBON"
  | "PINK_BOURBON"
  | "GEISHA"
  | "TABI"

type PricingInput = {
  scaScore: number
  altitude: number
  variety: Variety
  process: ProcessType
}

type PricingOutput = {
  basePrice: number
  altitudeModifier: number
  finalPrice: number
}

//////////////////////////////////////////////////////
// 🔍 HELPERS
//////////////////////////////////////////////////////

function getScaRange(sca: number): "80-83" | "84-86" | "86-90" {
  if (sca >= 80 && sca <= 83) return "80-83"
  if (sca >= 84 && sca <= 86) return "84-86"
  if (sca >= 87) return "86-90"

  throw new Error("SCA score out of supported range")
}

function getAltitudeModifier(altitude: number): number {
  const match = ALTITUDE_MODIFIER.find(
    (range) => altitude >= range.min && altitude < range.max
  )

  if (!match) return 0

  return match.value
}

//////////////////////////////////////////////////////
// 💰 MAIN FUNCTION
//////////////////////////////////////////////////////

export function calculatePricing(input: PricingInput): PricingOutput {
  const { scaScore, altitude, variety } = input

  // 1. determinar rango SCA
  const scaRange = getScaRange(scaScore)

  // 2. obtener precio base
  const basePrice = BASE_PRICING[scaRange][variety as keyof typeof BASE_PRICING[typeof scaRange]]

if (basePrice === undefined) {
    throw new Error(`No base price for variety ${variety} in range ${scaRange}`)
  }

  // 3. modifier altitud
  const altitudeModifier = getAltitudeModifier(altitude)

  // 4. precio final
  const finalPrice = basePrice + altitudeModifier

  return {
    basePrice,
    altitudeModifier,
    finalPrice,
  }
}