// =====================================================
// SHOCK DECAY ENGINE
//
// Reduce progresivamente la intensidad de shocks
// en commodities.
//
// Simula:
//
// - adaptación del mercado
// - normalización de supply chains
// - absorción de shocks por inventarios
//
// Sin este módulo los shocks se acumularían
// indefinidamente.
//
// Modelo:
//
// shock(t+1) = shock(t) * decayRate
//
// Donde:
//
// decayRate ≈ 0.90 → shock dura más
// decayRate ≈ 0.70 → shock desaparece rápido
// =====================================================

import type { EngineState }
from "@/src/engine/core/runtime"



/* =====================================================
DECAY PARAMETERS
===================================================== */

const DECAY_RATE = 0.92

const MIN_SHOCK_THRESHOLD = 0.01



/* =====================================================
DECAY COMMODITY SHOCKS
===================================================== */

export function decayCommodityShocks(

  state: EngineState

) {

  const shocks =
    state.commodityShockSignals ?? []


  const decayed = []


  /* -------------------------------------------------
  APPLY DECAY
  ------------------------------------------------- */

  for (const s of shocks) {

    const nextShock =
      s.shockPressure *
      DECAY_RATE


    /* -----------------------------------------------
    DROP NEGLIGIBLE SHOCKS
    ----------------------------------------------- */

    if (nextShock < MIN_SHOCK_THRESHOLD)
      continue


    decayed.push({

      commodity: s.commodity,

      shockPressure: nextShock

    })

  }


  /* -------------------------------------------------
  WRITE BACK TO STATE
  ------------------------------------------------- */

  state.commodityShockSignals =
    decayed

}