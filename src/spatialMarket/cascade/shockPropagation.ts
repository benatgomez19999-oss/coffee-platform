// =====================================================
// SHOCK PROPAGATION ENGINE
//
// Simula propagación de shocks entre regiones
// a través de la red comercial.
//
// Basado en:
//
// - flujos comerciales
// - estrés local
// - acoplamiento entre regiones
//
// Output:
//
// regional cascade stress
// =====================================================

import type { EngineState } from "@/engine/core/runtime"
import type { CommodityFlow } from "../flows/commodityFlowEngine"



// =====================================================
// CASCADE STRESS TYPE
// =====================================================

export type CascadeStress = {

  [region: string]: number

}



// =====================================================
// SHOCK PROPAGATION
// =====================================================

export function propagateSupplyShock(

  state: EngineState,

  flows: CommodityFlow[]

): CascadeStress {

  const stress: CascadeStress = {}

  const baseStress =
    state.supplyStressField ?? 0

  const collapse =
    state.collapseProbability ?? 0


  // -------------------------------------------------
  // INITIALIZE REGIONAL STRESS
  // -------------------------------------------------

  for (const r of state.regions) {

    stress[r.name] =
      baseStress +
      collapse * 0.3

  }


  // -------------------------------------------------
  // PROPAGATE THROUGH FLOWS
  // -------------------------------------------------

  for (const flow of flows) {

    const origin =
      flow.from

    const destination =
      flow.to

    const volume =
      flow.volume ?? 0


    const coupling =
      Math.min(
        0.4,
        volume / 10000
      )


    const originStress =
      stress[origin] ?? 0


    const propagated =
      originStress *
      coupling


    stress[destination] =
      (stress[destination] ?? 0)
      + propagated

  }


  // -------------------------------------------------
  // CLAMP VALUES
  // -------------------------------------------------

  for (const key in stress) {

    stress[key] =
      Math.max(
        0,
        Math.min(1, stress[key])
      )

  }

  return stress

}