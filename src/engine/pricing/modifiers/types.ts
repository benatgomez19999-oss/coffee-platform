//////////////////////////////////////////////////////
// 🧠 PRICING MODIFIER TYPES (CORE SYSTEM)
//////////////////////////////////////////////////////

export type ModifierType = "additive" | "multiplicative" | "market"

export type PricingContext = {
  basePrice: number

  scaScore: number
  altitude: number

  variety: string
  process: string

  country?: string
  certifications?: string[]

  marketData?: {
    cPrice?: number
    demandIndex?: number
  }
}

export interface PricingModifier {
  id: string
  type: ModifierType

  apply: (context: PricingContext) => number
}