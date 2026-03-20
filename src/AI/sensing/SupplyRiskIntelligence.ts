// =====================================================
// SUPPLY RISK INTELLIGENCE
//
// Interpreta señales de riesgo logístico
// y las transforma en señales sistémicas.
//
// No modifica el engine directamente.
// Solo produce señales para EngineContext.
//
// =====================================================


// =====================================================
// SUPPLY RISK INPUT
//
// Datos provenientes de:
//
// - congestión portuaria
// - retrasos de transporte
// - riesgo geopolítico
//
// =====================================================

export type SupplyRiskInput = {

  portCongestion: number
  shippingDelay: number
  geopoliticalRisk: number

}


// =====================================================
// SUPPLY RISK SIGNAL
//
// Señales sistémicas derivadas.
//
// logisticsStress → presión logística total
// disruptionProbability → probabilidad de interrupción
// delayFactor → impacto directo de retrasos
//
// =====================================================

export type SupplyRiskSignal = {

  logisticsStress: number
  disruptionProbability: number
  delayFactor: number

}


// =====================================================
// COMPUTE SUPPLY RISK SIGNAL
//
// Convierte señales logísticas en métricas
// normalizadas para el sistema.
//
// =====================================================

export function computeSupplyRiskSignal(
  input: SupplyRiskInput
): SupplyRiskSignal {

  // -----------------------------------------------------
  // LOGISTICS STRESS
  // -----------------------------------------------------

  const logisticsStress =
    input.portCongestion * 0.4 +
    input.shippingDelay * 0.4 +
    input.geopoliticalRisk * 0.2

  // -----------------------------------------------------
  // DISRUPTION PROBABILITY
  // -----------------------------------------------------

  const disruptionProbability =
    input.shippingDelay * 0.5 +
    input.geopoliticalRisk * 0.5

  // -----------------------------------------------------
  // DELAY FACTOR
  // -----------------------------------------------------

  const delayFactor =
    Math.max(0, Math.min(1, input.shippingDelay))

  return {

    logisticsStress,
    disruptionProbability,
    delayFactor

  }

}