//////////////////////////////////////////////////////
// ⚙️ MODIFIER ENGINE (APPLY PIPELINE)
//////////////////////////////////////////////////////

import { PricingModifier, PricingContext } from "@/src/engine/pricing/modifiers/types"

//////////////////////////////////////////////////////
// 📊 TYPES (BREAKDOWN)
//////////////////////////////////////////////////////

export type PricingStep = {
  id: string
  type: string
  value: number
  priceAfter: number
}

//////////////////////////////////////////////////////
// ⚙️ BASIC ENGINE (BACKWARD COMPATIBLE)
//////////////////////////////////////////////////////

export function applyModifiers(
  basePrice: number,
  modifiers: PricingModifier[],
  context: PricingContext
) {
  let price = basePrice

  //////////////////////////////////////////////////////
  // 1. ADDITIVE (sumas directas)
  //////////////////////////////////////////////////////

  for (const mod of modifiers.filter((m) => m.type === "additive")) {
    price += mod.apply(context)
  }

  //////////////////////////////////////////////////////
  // 2. MULTIPLICATIVE (factores)
  //////////////////////////////////////////////////////

  for (const mod of modifiers.filter((m) => m.type === "multiplicative")) {
    price *= mod.apply(context)
  }

  //////////////////////////////////////////////////////
  // 3. MARKET (dinámicos)
  //////////////////////////////////////////////////////

  for (const mod of modifiers.filter((m) => m.type === "market")) {
    price *= mod.apply(context)
  }

  return Number(price.toFixed(2))
}

//////////////////////////////////////////////////////
// 🧠 ADVANCED ENGINE (WITH BREAKDOWN)
//////////////////////////////////////////////////////

export function applyModifiersWithBreakdown(
  basePrice: number,
  modifiers: PricingModifier[],
  context: PricingContext
) {
  let price = basePrice

  const steps: PricingStep[] = []

  //////////////////////////////////////////////////////
  // 1. ADDITIVE
  //////////////////////////////////////////////////////

  for (const mod of modifiers.filter((m) => m.type === "additive")) {
    const value = mod.apply(context)
    price += value

    steps.push({
      id: mod.id,
      type: mod.type,
      value,
      priceAfter: Number(price.toFixed(2)),
    })
  }

  //////////////////////////////////////////////////////
  // 2. MULTIPLICATIVE
  //////////////////////////////////////////////////////

  for (const mod of modifiers.filter((m) => m.type === "multiplicative")) {
    const factor = mod.apply(context)
    price *= factor

    steps.push({
      id: mod.id,
      type: mod.type,
      value: factor,
      priceAfter: Number(price.toFixed(2)),
    })
  }

  //////////////////////////////////////////////////////
  // 3. MARKET
  //////////////////////////////////////////////////////

  for (const mod of modifiers.filter((m) => m.type === "market")) {
    const factor = mod.apply(context)
    price *= factor

    steps.push({
      id: mod.id,
      type: mod.type,
      value: factor,
      priceAfter: Number(price.toFixed(2)),
    })
  }

  return {
    finalPrice: Number(price.toFixed(2)),
    steps,
  }
}