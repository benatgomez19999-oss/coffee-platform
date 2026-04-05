//////////////////////////////////////////////////////
// 📈 C MARKET MODIFIER (GLOBAL COFFEE PRICE)
//////////////////////////////////////////////////////

import { PricingModifier } from "@/src/engine/pricing/modifiers/types"

export const commodityModifier: PricingModifier = {
  id: "C_MARKET",
  type: "market",

  apply: (ctx) => {
    if (!ctx.marketData?.cPrice) return 1

    //////////////////////////////////////////////////////
    // ☕ BASELINE (ajusta esto según mercado real)
    //////////////////////////////////////////////////////

    const baseline = 180 // cents/lb aprox

    const ratio = ctx.marketData.cPrice / baseline

    //////////////////////////////////////////////////////
    // 🔒 LIMITAR VOLATILIDAD
    //////////////////////////////////////////////////////

    return Math.max(0.85, Math.min(ratio, 1.25))
  },
}