// =====================================================
// STRATEGIC FORECAST ENGINE
//
// Interpreta los resultados de la simulación predictiva
// y genera señales estratégicas de alto nivel.
//
// Esta capa no ejecuta simulaciones.
// Solo interpreta resultados.
//
// =====================================================

import type { ForecastResult } from "./predictiveSimulation"


// =====================================================
// STRATEGIC FORECAST
//
// Señales estratégicas derivadas.
//
// strategicRisk → riesgo sistémico agregado
// interventionUrgency → necesidad de intervención
// decisionRobustness → estabilidad de decisiones
// systemFragility → fragilidad estructural
//
// NUEVO:
//
// systemStability → estabilidad global
// strategicConfidence → confianza en decisiones
// marketRegime → estado estratégico del mercado
//
// =====================================================

export type StrategicForecast = {

  strategicRisk: number
  interventionUrgency: number
  decisionRobustness: number
  systemFragility: number

  systemStability: number
  strategicConfidence: number

  marketRegime:
    | "stable"
    | "transition"
    | "stress"

}


// =====================================================
// CLAMP UTILITY
//
// Garantiza que métricas permanezcan en [0,1]
//
// =====================================================

function clamp01(v: number) {

  if (!Number.isFinite(v)) return 0

  return Math.max(0, Math.min(1, v))

}


// =====================================================
// COMPUTE STRATEGIC FORECAST
//
// Convierte métricas probabilísticas en señales
// estratégicas interpretables.
//
// =====================================================

export function computeStrategicForecast(
  forecast: ForecastResult
): StrategicForecast {

  const {

    collapseProbability,
    instabilityProbability,
    avgFinalPressure,
    avgCollapseProximity

  } = forecast


  // -----------------------------------------------------
  // STRATEGIC RISK
  // -----------------------------------------------------

  const strategicRisk =
    clamp01(
      collapseProbability * 0.5 +
      instabilityProbability * 0.3 +
      avgCollapseProximity * 0.2
    )


  // -----------------------------------------------------
  // INTERVENTION URGENCY
  // -----------------------------------------------------

  const interventionUrgency =
    clamp01(
      collapseProbability * 0.6 +
      avgCollapseProximity * 0.4
    )


  // -----------------------------------------------------
  // DECISION ROBUSTNESS
  // -----------------------------------------------------

  const decisionRobustness =
    clamp01(
      1 -
      (
        instabilityProbability * 0.6 +
        collapseProbability * 0.4
      )
    )


  // -----------------------------------------------------
  // SYSTEM FRAGILITY
  // -----------------------------------------------------

  const systemFragility =
    clamp01(
      avgFinalPressure * 0.4 +
      avgCollapseProximity * 0.6
    )


  // =====================================================
  // SYSTEM STABILITY INDEX
  //
  // Estabilidad global del sistema.
  // =====================================================

  const systemStability =
    clamp01(
      1 -
      (
        strategicRisk * 0.6 +
        systemFragility * 0.4
      )
    )


  // =====================================================
  // STRATEGIC CONFIDENCE
  //
  // Qué tan confiables son las decisiones actuales.
  // =====================================================

  const strategicConfidence =
    clamp01(
      decisionRobustness * 0.6 +
      systemStability * 0.4
    )


  // =====================================================
  // MARKET REGIME CLASSIFICATION
  //
  // Clasificación estratégica del sistema.
  // =====================================================

  let marketRegime: StrategicForecast["marketRegime"]

  if (strategicRisk > 0.65)
    marketRegime = "stress"

  else if (strategicRisk > 0.35)
    marketRegime = "transition"

  else
    marketRegime = "stable"


  return {

    strategicRisk,
    interventionUrgency,
    decisionRobustness,
    systemFragility,

    systemStability,
    strategicConfidence,

    marketRegime

  }

}