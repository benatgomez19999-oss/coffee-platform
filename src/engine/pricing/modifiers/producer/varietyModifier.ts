//////////////////////////////////////////////////////
// 🌸 VARIETY PREMIUM MODIFIER (PRODUCER)
//////////////////////////////////////////////////////

import { PricingModifier } from "../types"

export const producerVarietyModifier: PricingModifier = {
  id: "PRODUCER_VARIETY_PREMIUM",
  type: "multiplicative",

 apply: (ctx) => {
  //////////////////////////////////////////////////////
  // 🌸 BASE PREMIUM
  //////////////////////////////////////////////////////

  const premiums: Record<string, number> = {
    GEISHA: 1.70,
    PINK_BOURBON: 1.35,
  }

  let factor = premiums[ctx.variety] || 1

  //////////////////////////////////////////////////////
  // 🔥 HIGH-END STEP (NO lineal)
  //////////////////////////////////////////////////////

  if (ctx.variety === "GEISHA") {
    if (ctx.scaScore >= 90) factor += 0.5  // 🔥 aquí está el cambio real
    else if (ctx.scaScore >= 89) factor += 0.25
  }

  if (ctx.variety === "PINK_BOURBON") {
    if (ctx.scaScore >= 90) factor += 0.3
    else if (ctx.scaScore >= 89) factor += 0.15
  }

  return factor
},
}