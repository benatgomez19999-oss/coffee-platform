// =====================================================
// GLOBAL SCENARIO ENGINE
//
// Aplica shocks macroeconómicos al sistema
// para simular escenarios globales.
//
// =====================================================

import type { EngineState }
from "@/engine/core/runtime"

export type GlobalScenario =

  | "china-demand-shock"
  | "el-nino"
  | "suez-blockage"
  | "opec-cut"
  | "global-recession"



// =====================================================
// APPLY SCENARIO
// =====================================================

export function applyGlobalScenario(

  state: EngineState,
  scenario: GlobalScenario

) {

  switch (scenario) {

    // -------------------------------------------
    // CHINA DEMAND SHOCK
    // -------------------------------------------

    case "china-demand-shock":

      state.systemEnergy += 0.1

      state.systemFatigue += 0.05

      break


    // -------------------------------------------
    // EL NINO WEATHER EVENT
    // -------------------------------------------

    case "el-nino":

      state.systemFatigue += 0.1

      break


    // -------------------------------------------
    // SUEZ CANAL BLOCKAGE
    // -------------------------------------------

    case "suez-blockage":

      if (state.spatialMarket?.logistics) {

        state.spatialMarket.logistics.globalCongestion += 0.2

      }

      break


    // -------------------------------------------
    // OPEC PRODUCTION CUT
    // -------------------------------------------

    case "opec-cut":

      state.systemEnergy += 0.08

      break


    // -------------------------------------------
    // GLOBAL RECESSION
    // -------------------------------------------

    case "global-recession":

      state.systemEnergy -= 0.1

      break

  }

}