//////////////////////////////////////////////////////
// ⛰️ PRODUCER ALTITUDE MODIFIER
//////////////////////////////////////////////////////

import { PricingModifier } from "../types"
import { PRODUCER_ALTITUDE_MODIFIER } from "@/src/engine/pricing/producer/pricingTable" 

export const producerAltitudeModifier: PricingModifier = {
  id: "PRODUCER_ALTITUDE",
  type: "additive",

  apply: (ctx) => {
    const match = PRODUCER_ALTITUDE_MODIFIER.find(
      (range) => ctx.altitude >= range.min && ctx.altitude < range.max
    )

    if (!match) return 0

    return match.value
  },
}