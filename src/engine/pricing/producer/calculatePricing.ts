//////////////////////////////////////////////////////
// 🧠 PRODUCER PRICING ENGINE
//////////////////////////////////////////////////////

//////////////////////////////////////////////////////
// 🧩 MODULAR PRICING
//////////////////////////////////////////////////////
import {
  BASE_PRODUCER_PRICING,
  PRODUCER_ALTITUDE_MODIFIER,
} from "./pricingTable"

import { applyModifiers } from "@/engine/pricing/modifiers/engine"
import { PRODUCER_MODIFIERS } from "@/engine/pricing/modifiers/producer"
import { applyModifiersWithBreakdown } from "@/engine/pricing/modifiers/engine"

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
  country?: string

  marketData?: {
    cPrice?: number
    demandIndex?: number
  }
}

type PricingOutput = {
  basePrice: number
  altitudeModifier: number
  finalPrice: number
  breakdown: any[]
}

//////////////////////////////////////////////////////
// HELPERS
//////////////////////////////////////////////////////

function getScaRange(sca: number): "80-83" | "84-86" | "87-90" {
  if (sca >= 80 && sca <= 83) return "80-83"
  if (sca >= 84 && sca <= 86) return "84-86"
  if (sca >= 87) return "87-90"

  throw new Error("SCA score out of supported range")
}

function getAltitudeModifier(altitude: number): number {
  const match = PRODUCER_ALTITUDE_MODIFIER.find(
    (range) => altitude >= range.min && altitude < range.max
  )

  if (!match) return 0

  return match.value
}

//////////////////////////////////////////////////////
// MAIN
//////////////////////////////////////////////////////

export function calculateProducerPricing(
  input: PricingInput
): PricingOutput {
 const { scaScore, altitude, variety, process, country, marketData } = input

  const scaRange = getScaRange(scaScore)

  const basePrice =
    BASE_PRODUCER_PRICING[scaRange][
      variety as keyof typeof BASE_PRODUCER_PRICING[typeof scaRange]
    ]

  if (basePrice === undefined) {
    throw new Error(
      `No producer base price for variety ${variety} in range ${scaRange}`
    )
  }

  const altitudeModifier = getAltitudeModifier(altitude)

  //////////////////////////////////////////////////////
// 🧠 MODULAR PRICING LAYER
//////////////////////////////////////////////////////

//////////////////////////////////////////////////////
// 🧠 MODULAR PRICING WITH BREAKDOWN
//////////////////////////////////////////////////////

const { finalPrice, steps } = applyModifiersWithBreakdown(
  basePrice,
  PRODUCER_MODIFIERS,
  {
    basePrice,
    scaScore,
    altitude,
    variety,
    process,
    country,
    marketData,
  }
)

  return {
  basePrice,
  altitudeModifier,
  finalPrice,
  breakdown: steps,
}
}