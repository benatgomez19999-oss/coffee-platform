// =====================================================
// GLOBAL COMMODITY PORTFOLIO OPTIMIZER
//
// Calcula asignación de capital entre commodities
// considerando:
//
// - oportunidades
// - estrategias
// - shocks
// - fragilidad del sistema
// =====================================================

import type { EngineState }
from "@/engine/core/runtime"

export type CommodityAllocation = {

  commodity: string
  weight: number
  riskScore: number

}



export function optimizeCommodityPortfolio(

  state: EngineState

): CommodityAllocation[] {

  const allocations: CommodityAllocation[] = []

  const strategies =
    state.commodityStrategies ?? []

  const shocks =
    state.commodityShockSignals ?? []

  const fragility =
    state.systemFatigue ?? 0


  let totalScore = 0

  const tempScores: {

    commodity: string
    score: number
    risk: number

  }[] = []


  for (const strategy of strategies) {

    let baseScore = 0

    if (strategy.action === "enter")
      baseScore = 1

    if (strategy.action === "increase")
      baseScore = 0.8

    if (strategy.action === "hold")
      baseScore = 0.5

    if (strategy.action === "reduce")
      baseScore = 0.2

    if (strategy.action === "avoid")
      baseScore = 0


    const shock =
      shocks.find(
        s => s.commodity === strategy.commodity
      )?.shockPressure ?? 0


    const risk =
      shock * 0.6 +
      fragility * 0.4


    const score =
      Math.max(
        0,
        baseScore *
        strategy.confidence *
        (1 - risk)
      )


    totalScore += score

    tempScores.push({

      commodity: strategy.commodity,
      score,
      risk

    })

  }


  for (const t of tempScores) {

    const weight =
      totalScore > 0
        ? t.score / totalScore
        : 0

    allocations.push({

      commodity: t.commodity,
      weight,
      riskScore: t.risk

    })

  }


  return allocations.sort(
    (a, b) =>
      b.weight - a.weight
  )

}