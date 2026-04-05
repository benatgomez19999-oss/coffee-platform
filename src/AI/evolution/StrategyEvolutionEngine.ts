// =====================================================
// STRATEGY EVOLUTION ENGINE
//
// Selecciona, muta y evoluciona estrategias.
//
// =====================================================

import {
  createRandomGenome
} from "@/src/AI/evolution/StrategyGenome"

import { mutateGenome }
from "@/src/AI/evolution/StrategyMutationEngine"

import { runStrategyArena }
from "@/src/AI/evolution/StrategyArena"

import {
  initializeCapital,
  updateCapitalAllocation,
  normalizeCapital
} from "@/src/AI/evolution/CapitalCompetitionEngine"

let population = Array.from({ length: 5 }, () =>
  createRandomGenome()
)

// -------------------------------------------------
// INITIAL CAPITAL DISTRIBUTION
// -------------------------------------------------

initializeCapital(population)

// =====================================================
// EVOLVE
// =====================================================

export function evolveStrategies() {

  // -------------------------------------------------
  // ARENA COMPETITION
  // -------------------------------------------------

  population =
    runStrategyArena(population)

// -------------------------------------------------
// CAPITAL COMPETITION UPDATE
// -------------------------------------------------

updateCapitalAllocation(population)

  // -------------------------------------------------
  // SORT BY FITNESS
  // -------------------------------------------------

  population.sort(
    (a, b) => b.fitness - a.fitness
  )
  
  
  // -------------------------------------------------
  // NORMALIOZE CAPITAL
  // -------------------------------------------------
  normalizeCapital(population)

  // -------------------------------------------------
  // KEEP BEST
  // -------------------------------------------------

  const survivors =
    population.slice(0, 3)

  // -------------------------------------------------
  // MUTATE BEST
  // -------------------------------------------------

  const offspring = survivors.map(s =>
    mutateGenome(s)
  )

  // -------------------------------------------------
  // NEW RANDOM STRATEGY
  // -------------------------------------------------

  const randoms = [
    createRandomGenome()
  ]

  population = [
    ...survivors,
    ...offspring,
    ...randoms
  ]

  return population
}

// =====================================================
// UPDATE FITNESS (FROM REAL PnL)
//
// Refuerza o penaliza la población según resultados reales.
//
// =====================================================

export function updateFitness(pnl: number) {

  population.forEach(p => {

    p.fitness += pnl * 0.01

  })

}