//////////////////////////////////////////////////////
// 🧩 PRODUCER MODIFIERS REGISTRY
//////////////////////////////////////////////////////

import { producerAltitudeModifier } from "./altitudeModifier"
import { producerVarietyModifier } from "./varietyModifier"
import { producerCountryModifier } from "./countryModifier"
import { commodityModifier } from "./commodityModifier"
import { demandModifier } from "./demandModifier"

export const PRODUCER_MODIFIERS = [
  producerAltitudeModifier,
  producerVarietyModifier,
  producerCountryModifier,
  commodityModifier,
  demandModifier,
]