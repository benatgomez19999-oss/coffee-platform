// =====================================================
// SYSTEM INTELLIGENCE
//
// Integra todas las señales de inteligencia externa
// y las transforma en señales compatibles con
// EngineContext.
//
// Esta capa actúa como puente entre:
//
// AI sensing layer
// ↓
// EngineContext
//
// No modifica el engine directamente.
//
// =====================================================

import { WeatherSignal } from "@/src/AI/sensing/WeatherIntelligence"
import { DemandSignal } from "@/src/AI/sensing/DemandIntelligence"
import { SupplyRiskSignal } from "@/src/AI/sensing/SupplyRiskIntelligence"


// =====================================================
// AI SYSTEM SIGNALS
//
// Señales finales que alimentarán EngineContext.
//
// scenarioField → presión estructural externa
// anticipatoryBuffer → capacidad anticipatoria
// predictiveHorizon → estabilidad predictiva
// meaningField → coherencia estructural del sistema
// counterfactualSignal → presión de escenarios alternativos
//
// =====================================================

export type AISystemSignals = {

  scenarioField: number
  anticipatoryBuffer: number
  predictiveHorizon: number
  meaningField: number
  counterfactualSignal: number

}


// =====================================================
// COMPUTE AI SYSTEM SIGNALS
//
// Combina señales externas en un vector sistémico.
//
// =====================================================

export function computeAISystemSignals(

  weather: WeatherSignal,
  demand: DemandSignal,
  supply: SupplyRiskSignal

): AISystemSignals {

  // -----------------------------------------------------
  // SCENARIO FIELD
  //
  // Presión estructural externa combinada
  // -----------------------------------------------------

  const scenarioField =
    weather.productionShock * 0.4 +
    supply.logisticsStress * 0.35 +
    demand.demandMomentum * 0.25


  // -----------------------------------------------------
  // ANTICIPATORY BUFFER
  //
  // Capacidad del sistema para anticipar
  // perturbaciones estructurales
  // -----------------------------------------------------

  const anticipatoryBuffer =
    weather.persistence * 0.5 +
    supply.disruptionProbability * 0.5


  // -----------------------------------------------------
  // PREDICTIVE HORIZON
  //
  // Cuán predecible es el sistema
  // bajo condiciones actuales
  // -----------------------------------------------------

  const predictiveHorizon =
    1 -
    (
      demand.volatility * 0.4 +
      supply.delayFactor * 0.4 +
      weather.anomalyScore * 0.2
    )


  // -----------------------------------------------------
  // MEANING FIELD
  //
  // Coherencia estructural del sistema
  // -----------------------------------------------------

  const meaningField =
    demand.elasticityShift * 0.5 +
    weather.anomalyScore * 0.3 +
    supply.logisticsStress * 0.2


  // -----------------------------------------------------
  // COUNTERFACTUAL SIGNAL
  //
  // Intensidad de futuros alternativos
  // -----------------------------------------------------

  const counterfactualSignal =
    (weather.productionShock *
      supply.disruptionProbability) * 0.6 +
    demand.volatility * 0.4


  return {

    scenarioField,
    anticipatoryBuffer,
    predictiveHorizon,
    meaningField,
    counterfactualSignal

  }

}