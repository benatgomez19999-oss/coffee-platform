// =====================================================
// MICROLOT PORTFOLIO INTELLIGENCE ENGINE
//
// Analiza el portfolio de microlotes y genera
// inteligencia estratégica para:
//
// - priorizar ventas
// - estimar margen esperado
// - identificar lotes estratégicos
//
// Usa:
//
// - pricing engine
// - market learning
// - comportamiento histórico
// =====================================================

import {
  computeOriginDemandScore,
  MarketLearningState
} from "@/src/clientLayer/microlots/microLotMarketLearning"

export type PortfolioLot = {

  microLotId: string
  origin: string

  purchasePricePerKg: number
  estimatedMarketPricePerKg: number

  totalKg: number
  remainingKg: number

}

export type PortfolioInsight = {

  microLotId: string

  expectedMargin: number

  demandScore: number

  urgencyScore: number

}

// =====================================================
// COMPUTE EXPECTED MARGIN
// =====================================================

function computeExpectedMargin(

  lot: PortfolioLot

) {

  return (

    lot.estimatedMarketPricePerKg -

    lot.purchasePricePerKg

  )

}

// =====================================================
// COMPUTE DEMAND SIGNAL
// =====================================================

function computeDemandSignal(

  origin: string,

  marketLearning: MarketLearningState

) {

  return computeOriginDemandScore(
    marketLearning,
    origin
  )

}

// =====================================================
// COMPUTE URGENCY SCORE
// =====================================================

function computeUrgency(

  lot: PortfolioLot

) {

  const remainingRatio =
    lot.remainingKg /
    Math.max(1, lot.totalKg)

  if (remainingRatio > 0.7)
    return 0.8

  if (remainingRatio > 0.4)
    return 0.5

  return 0.2

}

// =====================================================
// PORTFOLIO ANALYSIS
// =====================================================

export function analyzeMicroLotPortfolio(

  lots: PortfolioLot[],

  marketLearning: MarketLearningState

): PortfolioInsight[] {

  const insights = lots.map(lot => {

    const expectedMargin =
      computeExpectedMargin(lot)

    const demandScore =
      computeDemandSignal(
        lot.origin,
        marketLearning
      )

    const urgencyScore =
      computeUrgency(lot)

    return {

      microLotId: lot.microLotId,

      expectedMargin,

      demandScore,

      urgencyScore

    }

  })

  return insights.sort(

    (a, b) =>

      b.expectedMargin * 0.5 +
      b.demandScore * 0.3 +
      b.urgencyScore * 0.2

      -

      (

        a.expectedMargin * 0.5 +
        a.demandScore * 0.3 +
        a.urgencyScore * 0.2

      )

  )

}