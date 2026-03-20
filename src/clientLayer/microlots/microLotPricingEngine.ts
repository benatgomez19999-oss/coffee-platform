// =====================================================
// MICROLOT PRICING ENGINE
//
// Calcula precios dinámicos para microlotes.
//
// Usa:
//
// - demanda histórica por origen
// - comportamiento del mercado
// - escasez del lote
// - comportamiento de clientes premium
//
// Devuelve:
//
// - precio recomendado
// - precio mínimo (reserve)
// - precio premium
// =====================================================

import {
  computeOriginDemandScore,
  computeClientPremiumIndex,
  MarketLearningState
} from "@/clientLayer/microlots/microLotMarketLearning"

export type MicroLotPricingInput = {

  origin: string

  basePricePerKg: number

  totalKg: number

  marketLearning: MarketLearningState

}

export type MicroLotPricingResult = {

  recommendedPrice: number

  reservePrice: number

  premiumPrice: number

}

// =====================================================
// COMPUTE SCARCITY FACTOR
// =====================================================

function computeScarcityFactor(totalKg: number) {

  if (totalKg < 40)
    return 1.25

  if (totalKg < 80)
    return 1.15

  if (totalKg < 150)
    return 1.05

  return 1

}

// =====================================================
// COMPUTE DEMAND FACTOR
// =====================================================

function computeDemandFactor(

  origin: string,

  marketLearning: MarketLearningState

) {

  const demandScore =
    computeOriginDemandScore(
      marketLearning,
      origin
    )

  if (!demandScore)
    return 1

  const normalized =
    demandScore / 40

  return Math.max(
    0.9,
    Math.min(1.3, normalized)
  )

}

// =====================================================
// COMPUTE PREMIUM CLIENT FACTOR
// =====================================================

function computePremiumFactor(

  marketLearning: MarketLearningState

) {

  const premiumSignals =
    marketLearning.records.filter(
      r => r.event === "auction_win"
    )

  if (premiumSignals.length === 0)
    return 1

  const avgPremium =

    premiumSignals.reduce(
      (sum, r) => sum + r.pricePerKg,
      0
    ) / premiumSignals.length

  const normalized =
    avgPremium / 40

  return Math.max(
    1,
    Math.min(1.2, normalized)
  )

}

// =====================================================
// MAIN PRICING ENGINE
// =====================================================

export function computeMicroLotPricing(

  input: MicroLotPricingInput

): MicroLotPricingResult {

  const scarcityFactor =
    computeScarcityFactor(
      input.totalKg
    )

  const demandFactor =
    computeDemandFactor(
      input.origin,
      input.marketLearning
    )

  const premiumFactor =
    computePremiumFactor(
      input.marketLearning
    )

  const recommendedPrice =

    input.basePricePerKg *
    scarcityFactor *
    demandFactor

  const reservePrice =
    recommendedPrice * 0.9

  const premiumPrice =
    recommendedPrice * premiumFactor

  return {

    recommendedPrice,

    reservePrice,

    premiumPrice

  }

}