//////////////////////////////////////////////////////
// 🌸 VARIETY PREMIUM MODIFIER (PRODUCER)
//////////////////////////////////////////////////////

import { PricingModifier } from "../types"

export const producerVarietyModifier: PricingModifier = {
  id: "PRODUCER_VARIETY_PREMIUM",
  type: "multiplicative",

  apply: (ctx) => {
    //////////////////////////////////////////////////////
    // 🌸 PREMIUM VARIETIES
    //////////////////////////////////////////////////////

    const premiums: Record<string, number> = {
      GEISHA: 1.6,
      PINK_BOURBON: 1.25,
    }

    return premiums[ctx.variety] || 1
  },
}