// =====================================================
// MONTE CARLO MARKET FUTURES
//
// Simula múltiples futuros posibles del mercado.
//
// Basado en:
//
// - perturbaciones estocásticas
// - evolución del engine
// - dinámica del spatial market
//
// Output:
//
// distribución de precios
// probabilidad de colapso
// estabilidad de oportunidades
// =====================================================

import type { EngineState } from "@/engine/core/runtime"

import { stepSimulationReal }
from "@/engine/core/simulationReal"



/* =====================================================
RESULT TYPE
===================================================== */

export type MonteCarloResult = {

  priceSamples: number[]

  collapseSamples: number[]

}



/* =====================================================
STATE CLONE
===================================================== */

function cloneState(
  state: EngineState
): EngineState {

  return JSON.parse(
    JSON.stringify(state)
  )

}



/* =====================================================
RANDOM PERTURBATION
===================================================== */

function perturbState(
  state: EngineState
) {

  const noise =
    (Math.random() - 0.5) * 0.1

  state.unifiedPressure =
    Math.max(
      0,
      Math.min(
        1,
        state.unifiedPressure + noise
      )
    )

}



/* =====================================================
MONTE CARLO SIMULATION
===================================================== */

export function runMonteCarloMarketFutures(

  initialState: EngineState,

  simulations = 200,

  steps = 200

): MonteCarloResult {

  const priceSamples: number[] = []

  const collapseSamples: number[] = []


  for (let i = 0; i < simulations; i++) {

    const state =
      cloneState(initialState)


    perturbState(state)


    for (let t = 0; t < steps; t++) {

  const ctx: any = {
    simulationMode: "Normal"
  }

  stepSimulationReal(
    state,
    ctx,
    1 / 60
  )

}


    priceSamples.push(
      state.systemEnergy * 100
    )

    collapseSamples.push(
      state.collapseProbability
    )

  }


  return {

    priceSamples,
    collapseSamples

  }

}