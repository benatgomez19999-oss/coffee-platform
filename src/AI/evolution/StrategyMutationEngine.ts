// =====================================================
// MUTATION ENGINE
//
// Introduce variaciones en estrategias.
//
// =====================================================

import type { StrategyGenome } from "@/src/AI/evolution/StrategyGenome"

export function mutateGenome(
  genome: StrategyGenome
): StrategyGenome {

  const mutate = (v: number) =>
    Math.max(0, Math.min(1, v + (Math.random() - 0.5) * 0.2))

  return {

    ...genome,

    entryThreshold: mutate(genome.entryThreshold),
    riskTolerance: mutate(genome.riskTolerance),
    aggressiveness: mutate(genome.aggressiveness),

    id: Math.random().toString(36).slice(2)

  }

}