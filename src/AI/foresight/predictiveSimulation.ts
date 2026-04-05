// =====================================================
// PREDICTIVE SIMULATION
//
// Ejecuta múltiples simulaciones del futuro
// del sistema usando el motor físico real.
//
// Permite estimar:
//
// - collapseProbability futura
// - instabilityProbability
// - trayectoria media de presión
//
// No modifica el runtime real.
// Solo ejecuta simulaciones aisladas.
//
// =====================================================

import { stepSimulationReal } from "@/src/engine/core/simulationReal"
import { setEngineSeed } from "@/src/engine/core/runtime"

import type { EngineState, EngineContext } from "@/src/engine/core/runtime"


// =====================================================
// FORECAST OPTIONS
// =====================================================

export type ForecastOptions = {

  simulations: number
  horizonSeconds: number
  dt: number
  noiseAmplitude?: number

}


// =====================================================
// FORECAST RESULT
// =====================================================

export type ForecastResult = {

  collapseProbability: number
  instabilityProbability: number
  avgFinalPressure: number
  avgCollapseProximity: number

}


// =====================================================
// STATE CLONE
//
// Deep copy seguro del estado del motor.
// =====================================================

function cloneState(state: EngineState): EngineState {

  return JSON.parse(JSON.stringify(state))

}


// =====================================================
// CONTEXT CLONE
// =====================================================

function cloneContext(ctx: EngineContext): EngineContext {

  return JSON.parse(JSON.stringify(ctx))

}


// =====================================================
// NOISE INJECTION
//
// Introduce pequeñas perturbaciones
// para generar futuros alternativos.
//
// =====================================================

function injectNoise(
  state: EngineState,
  amplitude: number
) {

  const noise = () => (Math.random() - 0.5) * amplitude

  state.pressureMomentum += noise() * 0.05
  state.systemFatigue += noise() * 0.02
  state.shockLevel += noise() * 0.05

}


// =====================================================
// RUN MONTE CARLO FORECAST
//
// Ejecuta múltiples futuros posibles del sistema.
//
// =====================================================

export function runMonteCarloForecast(

  baseState: EngineState,
  baseContext: EngineContext,
  options: ForecastOptions

): ForecastResult {

  const {

    simulations,
    horizonSeconds,
    dt,
    noiseAmplitude = 0.05

  } = options


  const steps = Math.floor(horizonSeconds / dt)


  let collapseCount = 0
  let instabilityCount = 0

  let totalPressure = 0
  let totalCollapseProximity = 0


  for (let i = 0; i < simulations; i++) {

    // universo reproducible
    setEngineSeed(i + 1)

    const state = cloneState(baseState)
    const ctx = cloneContext(baseContext)

    injectNoise(state, noiseAmplitude)

    for (let s = 0; s < steps; s++) {

      stepSimulationReal(state, ctx, dt)

    }

    totalPressure += state.unifiedPressure ?? 0
    totalCollapseProximity += state.collapseProximity ?? 0


    if ((state.collapseProbability ?? 0) > 0.7) {

      collapseCount++

    }

    if ((state.lyapunovIndicator ?? 0) > 0.6) {

      instabilityCount++

    }

  }


  return {

    collapseProbability: collapseCount / simulations,

    instabilityProbability: instabilityCount / simulations,

    avgFinalPressure: totalPressure / simulations,

    avgCollapseProximity: totalCollapseProximity / simulations

  }

}