//////////////////////////////////////////////////////
// 🧩 PRODUCER MODIFIERS REGISTRY
//////////////////////////////////////////////////////

import { producerAltitudeModifier } from "@/src/engine/pricing/modifiers/producer/altitudeModifier"
import { producerVarietyModifier } from "@/src/engine/pricing/modifiers/producer//varietyModifier"
import { producerCountryModifier } from "@/src/engine/pricing/modifiers/producer//countryModifier"
import { commodityModifier } from "@/src/engine/pricing/modifiers/producer//commodityModifier"
import { demandModifier } from "@/src/engine/pricing/modifiers/producer//demandModifier"

export const PRODUCER_MODIFIERS = [
  producerAltitudeModifier,
  producerVarietyModifier,
  producerCountryModifier,
  commodityModifier,
  demandModifier,
]