// =====================================================
// GLOBAL SHOCK MEMORY FIELD
//
// Mantiene memoria estructural de shocks sistémicos.
//
// Incluso cuando los shocks individuales desaparecen,
// el sistema puede seguir acumulando fragilidad.
//
// Esto permite modelar:
//
// - crisis sistémicas
// - commodity supercycles
// - regímenes de mercado largos
//
// Modelo:
//
// memory(t+1) = memory(t) * decay
//               + newShockImpact
//
// =====================================================

import type { EngineState }
from "@/engine/core/runtime"



/* =====================================================
MEMORY PARAMETERS
===================================================== */

const MEMORY_DECAY = 0.96

const SHOCK_IMPACT_GAIN = 0.4

const MAX_MEMORY = 1



/* =====================================================
GLOBAL SHOCK MEMORY STRUCTURE
===================================================== */

export type GlobalShockMemory = {

  energyStress: number

  logisticsStress: number

  foodStress: number

  climateStress: number

  systemicFragility: number

}



/* =====================================================
UPDATE GLOBAL SHOCK MEMORY
===================================================== */

export function updateGlobalShockMemory(

  state: EngineState

) {

  const shocks =
    state.commodityShockSignals ?? []


  const baseStress =
    state.supplyStressField ?? 0


  // -------------------------------------------------
  // INITIALIZE MEMORY IF MISSING
  // -------------------------------------------------

  if (!state.globalShockMemory) {

    state.globalShockMemory = {

      energyStress: 0,

      logisticsStress: 0,

      foodStress: 0,

      climateStress: 0,

      systemicFragility: 0

    }

  }


  const memory =
    state.globalShockMemory


  // -------------------------------------------------
  // DECAY PREVIOUS MEMORY
  // -------------------------------------------------

  memory.energyStress *= MEMORY_DECAY
  memory.logisticsStress *= MEMORY_DECAY
  memory.foodStress *= MEMORY_DECAY
  memory.climateStress *= MEMORY_DECAY


  // -------------------------------------------------
  // ADD NEW SHOCK CONTRIBUTIONS
  // -------------------------------------------------

  for (const s of shocks) {

    const impact =
      s.shockPressure *
      SHOCK_IMPACT_GAIN


    const commodity =
      s.commodity.toLowerCase()


    /* -----------------------------------------------
    ENERGY SHOCKS
    ----------------------------------------------- */

    if (
      commodity.includes("oil") ||
      commodity.includes("gas") ||
      commodity.includes("coal")
    ) {

      memory.energyStress += impact

    }


    /* -----------------------------------------------
    FOOD SHOCKS
    ----------------------------------------------- */

    if (
      commodity.includes("wheat") ||
      commodity.includes("corn") ||
      commodity.includes("soy") ||
      commodity.includes("rice")
    ) {

      memory.foodStress += impact

    }

  }


  // -------------------------------------------------
  // LOGISTICS STRESS FROM ENGINE STATE
  // -------------------------------------------------

  memory.logisticsStress +=
    baseStress *
    0.3


  // -------------------------------------------------
  // CLAMP MEMORY VALUES
  // -------------------------------------------------

  memory.energyStress =
    Math.min(MAX_MEMORY, memory.energyStress)

  memory.logisticsStress =
    Math.min(MAX_MEMORY, memory.logisticsStress)

  memory.foodStress =
    Math.min(MAX_MEMORY, memory.foodStress)

  memory.climateStress =
    Math.min(MAX_MEMORY, memory.climateStress)


  // -------------------------------------------------
  // COMPUTE SYSTEMIC FRAGILITY
  // -------------------------------------------------

  memory.systemicFragility =

    Math.min(

      1,

      memory.energyStress * 0.3 +

      memory.foodStress * 0.3 +

      memory.logisticsStress * 0.3 +

      memory.climateStress * 0.1

    )


  // -------------------------------------------------
  // WRITE BACK INTO ENGINE STATE
  // -------------------------------------------------

  state.systemFragility =
    memory.systemicFragility

}