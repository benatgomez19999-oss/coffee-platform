// =====================================================
// STRATEGY GENOME
//
// Representación evolutiva de estrategias.
//
// =====================================================

export type StrategyGenome = {

  id: string

  commodity: string

  entryThreshold: number
  riskTolerance: number
  aggressiveness: number

  fitness: number

}

// =====================================================
// CREATE RANDOM STRATEGY
// =====================================================

export function createRandomGenome(): StrategyGenome {

  return {

    id: Math.random().toString(36).slice(2),

    commodity: "coffee",

    entryThreshold: Math.random(),
    riskTolerance: Math.random(),
    aggressiveness: Math.random(),

    fitness: 0

  }

}