// =====================================================
// COMMODITY SHOCK PROPAGATION ENGINE
//
// Propaga shocks entre commodities utilizando
// el Commodity Dependency Graph.
//
// A diferencia de propagateSupplyShock:
//
// propagateSupplyShock → REGION → REGION
// propagateCommodityShock → COMMODITY → COMMODITY
//
// Ejemplo:
//
// oil shock
// ↓
// fertilizer cost
// ↓
// wheat production
// ↓
// food prices
//
// Permite modelar:
//
// - contagio de precios
// - cascadas macroeconómicas
// - dependencias estructurales
// =====================================================

import type { EngineState } from "@/src/engine/core/runtime"

import { commodityDependencyGraph }
from "../graph/commodityDependencyGraph"



/* =====================================================
PROPAGATE COMMODITY SHOCK
===================================================== */

export function propagateCommodityShock(

  state: EngineState

) {

  const shocks =
    state.commodityShockSignals ?? []


  const propagated: Record<string, number> = {}


  /* -------------------------------------------------
  INITIALIZE BASE SHOCKS
  ------------------------------------------------- */

  for (const s of shocks) {

    propagated[s.commodity] =

      (propagated[s.commodity] ?? 0)

      + s.shockPressure

  }


  /* -------------------------------------------------
  PROPAGATE THROUGH DEPENDENCY GRAPH
  ------------------------------------------------- */

  for (const edge of commodityDependencyGraph) {

    const sourceShock =
      propagated[edge.from] ?? 0


    if (sourceShock === 0)
      continue


    const impact =
      sourceShock *
      edge.weight


    propagated[edge.to] =

      (propagated[edge.to] ?? 0)

      + impact

  }


  /* -------------------------------------------------
  CLAMP VALUES
  ------------------------------------------------- */

  for (const key in propagated) {

    propagated[key] =

      Math.max(
        0,
        Math.min(1, propagated[key])
      )

  }


  /* -------------------------------------------------
  WRITE BACK TO STATE
  ------------------------------------------------- */

  state.commodityShockSignals =

    Object.entries(propagated)

      .map(([commodity, shockPressure]) => ({

        commodity,

        shockPressure

      }))

}