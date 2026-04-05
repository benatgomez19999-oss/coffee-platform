//////////////////////////////////////////////////////
// 🔥 DEMAND MODIFIER (INTERNAL MARKET SIGNAL)
//////////////////////////////////////////////////////

import { PricingModifier } from "@/src/engine/pricing/modifiers/types"

export const demandModifier: PricingModifier = {
  id: "DEMAND",
  type: "market",

  apply: (ctx) => {
    if (!ctx.marketData?.demandIndex) return 1

    //////////////////////////////////////////////////////
    // 📊 demandIndex esperado: 0.8 → 1.2
    //////////////////////////////////////////////////////

    return ctx.marketData.demandIndex
  },
}