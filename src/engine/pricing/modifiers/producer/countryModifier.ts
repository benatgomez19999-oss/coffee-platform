//////////////////////////////////////////////////////
// 🌍 COUNTRY MULTIPLIER (PRODUCER)
//////////////////////////////////////////////////////

import { PricingModifier } from "@/src/engine/pricing/modifiers/types"

export const producerCountryModifier: PricingModifier = {
  id: "PRODUCER_COUNTRY",
  type: "multiplicative",

  apply: (ctx) => {
    if (!ctx.country) return 1

    //////////////////////////////////////////////////////
    // 🌍 MARKET PERCEPTION BY ORIGIN
    //////////////////////////////////////////////////////

    const countryFactors: Record<string, number> = {
      ETHIOPIA: 1.1,
      COLOMBIA: 1.05,
      PANAMA: 1.25,
      KENYA: 1.15,
      BRAZIL: 0.95,
    }

    return countryFactors[ctx.country.toUpperCase()] || 1
  },
}