// =====================================================
// RISK MODEL — SYSTEMIC RISK EVALUATION
// calcula riesgo estructural ajustado
// =====================================================

import type { EngineState } from "@/src/engine/core/runtime"
import { computeCascadeRisk } from "@/src/brain/cascadeDetector"
import { computePhaseTransitionRisk } from "@/src/brain/phaseTransitionDetector"

export function computeAdjustedRisk(
  state: EngineState,
  riskScore: number,
  clampedConfidence: number
) {

  // =====================================================
  // CASCADE RISK — SYSTEMIC COUPLING
  // mide riesgo de propagación entre regiones
  // =====================================================

  const cascadeRisk =
    computeCascadeRisk(state)

  // =====================================================
  // PHASE TRANSITION RISK — TIPPING POINT SIGNAL
  // detecta pérdida de estabilidad estructural
  // usando critical slowing + Lyapunov + energy
  // =====================================================

  const phaseRisk =
    computePhaseTransitionRisk(state)

  // =====================================================
  // BASE RISK COMPOSITION
  // combina riesgo sistémico + cascada + transición
  // =====================================================

  let adjustedRisk =
    riskScore +
    cascadeRisk * 0.25 +
    phaseRisk * 0.35

  // =====================================================
  // CONFIDENCE ADJUSTMENT
  // si la confianza del diagnóstico baja
  // el sistema se vuelve más conservador
  // =====================================================

  adjustedRisk =
    adjustedRisk *
    (1 + (1 - clampedConfidence) * 0.6)

  // =====================================================
  // RETURN STRUCTURE
  // =====================================================

  return {
    adjustedRisk,
    cascadeRisk
  }

}