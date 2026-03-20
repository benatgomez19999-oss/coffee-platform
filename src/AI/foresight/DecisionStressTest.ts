// =====================================================
// DECISION STRESS TEST
//
// Evalúa la robustez de decisiones simulando futuros
// alternativos bajo diferentes perturbaciones.
//
// Output:
// decisionRobustness (0..1)
//
// =====================================================

import { stepSimulationReal } from "@/engine/simulationReal"
import type { EngineState, EngineContext } from "@/engine/runtime"

const clamp01 = (x: number) =>
  Math.max(0, Math.min(1, x))


export function runDecisionStressTest(
  baseState: EngineState,
  context: EngineContext
) {

  // -----------------------------------------------------
  // CONFIG
  // -----------------------------------------------------

  const simulations = 30
  const horizonSteps = 60
  const dt = 1 / 60

  let collapseAccum = 0

  for (let s = 0; s < simulations; s++) {

    // -----------------------------------------------------
    // STATE CLONE
    // -----------------------------------------------------

    const state: EngineState = JSON.parse(
      JSON.stringify(baseState)
    )

    // -----------------------------------------------------
    // RANDOM PERTURBATION
    // -----------------------------------------------------

    state.shockLevel += Math.random() * 0.1
    state.systemFatigue += Math.random() * 0.05

    // -----------------------------------------------------
    // FORWARD SIMULATION
    // -----------------------------------------------------

    for (let i = 0; i < horizonSteps; i++) {

      stepSimulationReal(state, context, dt)

    }

    collapseAccum += state.collapseProbability

  }

  const avgCollapse =
    collapseAccum / simulations

  // -----------------------------------------------------
  // ROBUSTNESS SCORE
  // -----------------------------------------------------

  const robustness =
    1 - avgCollapse

  return {
    decisionRobustness: clamp01(robustness)
  }

}