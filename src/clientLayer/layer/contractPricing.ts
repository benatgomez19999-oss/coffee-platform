//////////////////////////////////////////////////////
// 📦 CONTRACT PRICING ENGINE
//////////////////////////////////////////////////////

import { calculatePricing } from "@/engine/pricing/client/calculatePricing"

type ContractPricingInput = {
  pricingInput: any
  volumeKg: number
}

export function calculateContractPricing(input: ContractPricingInput) {
  const { pricingInput, volumeKg } = input

  //////////////////////////////////////////////////////
  // 1. BASE PRICING (ENGINE)
  //////////////////////////////////////////////////////

  const base = calculatePricing(pricingInput)

  //////////////////////////////////////////////////////
  // 2. VOLUME ADJUSTMENTS
  //////////////////////////////////////////////////////

  let adjustments = {
    roasting: 0,
    packaging: 0,
    freight: 0,
  }

  if (volumeKg > 500) {
    adjustments.packaging = -0.1
  }

  if (volumeKg > 1000) {
    adjustments.roasting = -0.5
  }

  if (volumeKg > 3000) {
    adjustments.freight = -0.1
  }

  //////////////////////////////////////////////////////
  // 3. APPLY COST REDUCTION
  //////////////////////////////////////////////////////

  const costReduction =
    adjustments.roasting +
    adjustments.packaging +
    adjustments.freight

  //////////////////////////////////////////////////////
  // 4. FINAL PRICE
  //////////////////////////////////////////////////////

  const adjustedPrice =
    base.clientPrice - costReduction * 1.2

  //////////////////////////////////////////////////////
  // 5. OUTPUT
  //////////////////////////////////////////////////////

  return {
    ...base,

    contractPrice: Number(adjustedPrice.toFixed(2)),

    volume: volumeKg,

    volumeAdjustments: adjustments,
  }
}