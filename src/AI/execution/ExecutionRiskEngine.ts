// =====================================================
// EXECUTION RISK ENGINE
//
// Evalúa el riesgo antes de ejecutar una operación.
// Considera:
//
// - fatiga sistémica
// - estrés de suministro
// - margen de la ruta
// - régimen del mercado
//
// Devuelve una decisión:
//
// execute
// reduce
// delay
// cancel
// =====================================================

import type { EngineState }
from "@/src/engine/core/runtime"

export type ExecutionDecision = {

  action:
    | "execute"
    | "reduce"
    | "delay"
    | "cancel"

  volumeMultiplier: number
  riskScore: number

}

export function evaluateExecutionRisk(

  state: EngineState,
  expectedMargin: number

): ExecutionDecision {

  // -----------------------------------------------------
  // SYSTEM RISK
  // -----------------------------------------------------

  const fatigue =
    state.systemFatigue ?? 0

  const supplyStress =
    state.supplyStressField ?? 0

  const collapseRisk =
    state.collapseProbability ?? 0

  const marketRegime =
    state.commodityMarketRegime ?? "stable-market"


  // -----------------------------------------------------
  // RISK SCORE
  // -----------------------------------------------------

  const systemicRisk =
    fatigue * 0.4 +
    supplyStress * 0.3 +
    collapseRisk * 0.3


  const marginSafety =
    expectedMargin / 200


  const riskScore =
    systemicRisk - marginSafety * 0.3


  // -----------------------------------------------------
  // DECISION LOGIC
  // -----------------------------------------------------

  if (riskScore > 0.8) {

    return {
      action: "cancel",
      volumeMultiplier: 0,
      riskScore
    }

  }

  if (riskScore > 0.6) {

    return {
      action: "delay",
      volumeMultiplier: 0,
      riskScore
    }

  }

  if (riskScore > 0.4) {

    return {
      action: "reduce",
      volumeMultiplier: 0.5,
      riskScore
    }

  }

  return {
    action: "execute",
    volumeMultiplier: 1,
    riskScore
  }

}