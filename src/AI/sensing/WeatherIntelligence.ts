// =====================================================
// WEATHER INTELLIGENCE
//
// Interpreta señales climáticas externas
// y las transforma en señales sistémicas.
//
// No modifica el engine directamente.
// Solo produce señales para EngineContext.
//
// =====================================================


// =====================================================
// WEATHER INPUT
//
// Datos provenientes de fuentes externas:
// - APIs meteorológicas
// - datasets climáticos
// - modelos agrícolas
// =====================================================

export type WeatherInput = {

  rainfallAnomaly: number
  temperatureAnomaly: number
  droughtIndex: number
  frostRisk: number

}


// =====================================================
// WEATHER SIGNAL
//
// Señales sistémicas derivadas.
//
// productionShock → impacto directo en producción
// anomalyScore → inestabilidad climática general
// persistence → probabilidad de impacto prolongado
// =====================================================

export type WeatherSignal = {

  productionShock: number
  anomalyScore: number
  persistence: number

}


// =====================================================
// COMPUTE WEATHER SIGNAL
//
// Convierte datos meteorológicos en señales
// normalizadas para el sistema.
// =====================================================

export function computeWeatherSignal(
  input: WeatherInput
): WeatherSignal {

  // -----------------------------------------------------
  // ANOMALY SCORE
  // -----------------------------------------------------

  const anomalyScore =
    Math.abs(input.rainfallAnomaly) * 0.35 +
    Math.abs(input.temperatureAnomaly) * 0.25 +
    input.droughtIndex * 0.25 +
    input.frostRisk * 0.15

  // -----------------------------------------------------
  // PRODUCTION SHOCK
  // -----------------------------------------------------

  const productionShock =
    Math.max(0, Math.min(1, anomalyScore))

  // -----------------------------------------------------
  // PERSISTENCE
  // -----------------------------------------------------

  const persistence =
    input.droughtIndex * 0.6 +
    input.frostRisk * 0.4

  return {

    productionShock,
    anomalyScore,
    persistence

  }

}