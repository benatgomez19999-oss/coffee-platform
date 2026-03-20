// =====================================================
// CAPITAL COMPETITION ENGINE
//
// Asigna capital dinámicamente a estrategias.
//
// =====================================================

import type { StrategyGenome }
from "./StrategyGenome"

// =====================================================
// CAPITAL STATE
// =====================================================

let capitalMap: Record<string, number> = {}

// =====================================================
// INITIALIZE
// =====================================================

export function initializeCapital(population: StrategyGenome[]) {

  const equal =
    1 / Math.max(1, population.length)

  population.forEach(p => {
    capitalMap[p.id] = equal
  })

}

// =====================================================
// UPDATE CAPITAL BASED ON FITNESS
// =====================================================

export function updateCapitalAllocation(
  population: StrategyGenome[]
) {

  const totalFitness =
    population.reduce((sum, p) =>
      sum + Math.max(0, p.fitness), 0
    )

  if (totalFitness === 0) return

  population.forEach(p => {

    const weight =
      Math.max(0, p.fitness) / totalFitness

    capitalMap[p.id] = weight

  })

}

// =====================================================
// GET CAPITAL WEIGHT
// =====================================================

export function getCapitalWeight(id: string): number {

  return capitalMap[id] ?? 0

}

// =====================================================
// CAPITAL STRATEGIES FILTER 
// =====================================================

export function normalizeCapital(population: any[]) {

  const totalFitness =
    population.reduce((sum, p) => sum + Math.max(0, p.fitness), 0)

  if (totalFitness === 0) return

  population.forEach(p => {

    const weight =
      Math.max(0, p.fitness) / totalFitness

    p.capital = weight

  })

}