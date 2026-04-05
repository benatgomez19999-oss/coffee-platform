// =====================================================
// STRATEGY ARENA
//
// Las estrategias compiten entre sí.
//
// =====================================================

import type { StrategyGenome } from "@/src/AI/evolution/StrategyGenome"

// =====================================================
// ARENA RESULT
// =====================================================

type ArenaResult = {
  id: string
  score: number
}

// =====================================================
// SIMULATE STRATEGY
// =====================================================

function simulateStrategy(
  genome: StrategyGenome
): number {

  // -------------------------------------------------
  // FAKE MARKET SIMULATION (por ahora)
  // -------------------------------------------------

  const signal =
    Math.random()

  const performance =
    genome.aggressiveness * signal -
    genome.riskTolerance * Math.random()

  return performance
}

// =====================================================
// RUN ARENA
// =====================================================

export function runStrategyArena(
  population: StrategyGenome[]
): StrategyGenome[] {

  const results: ArenaResult[] = []

  for (const genome of population) {

    const score =
      simulateStrategy(genome)

    results.push({
      id: genome.id,
      score
    })

  }

  // -------------------------------------------------
  // RANKING
  // -------------------------------------------------

  results.sort((a, b) => b.score - a.score)

  // -------------------------------------------------
  // UPDATE FITNESS
  // -------------------------------------------------

  const updated = population.map(g => {

    const res =
      results.find(r => r.id === g.id)

    return {
      ...g,
      fitness: res?.score ?? 0
    }

  })

  return updated
}