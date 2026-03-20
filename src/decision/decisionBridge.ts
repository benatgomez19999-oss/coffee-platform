// =====================================================
// DECISION BRIDGE — SYSTEM OBSERVER
// Ejecuta pipeline de decisiones sincronizado con simTick.
// No modifica dinámica — solo observa.
// =====================================================

import { runDecisionPipeline } from "../decision/decisionPipeline"

export interface DecisionInputs {

  unifiedPressure: number
  adaptiveStress: number

  requestedVolume: number
  availableNow: number
  forecastIncoming: number

  clientPriority: number
  safetyBuffer: number

}

export function evaluateSystemDecision(
  inputs: DecisionInputs
) {

  return runDecisionPipeline({

    requestedVolume: inputs.requestedVolume,
    availableNow: inputs.availableNow,
    forecastIncoming: inputs.forecastIncoming,

    riskScore: inputs.unifiedPressure,
    adaptiveStress: inputs.adaptiveStress,

    clientPriority: inputs.clientPriority,
    safetyBuffer: inputs.safetyBuffer

  })

}