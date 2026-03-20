// =====================================================
// DEMAND INTELLIGENCE
//
// Interpreta señales de demanda del mercado
// y las transforma en señales sistémicas.
//
// No modifica el engine directamente.
// Solo produce señales para EngineContext.
//
// =====================================================


// =====================================================
// DEMAND INPUT
//
// Datos provenientes de:
// - tendencias de consumo
// - elasticidad de precio
// - volatilidad de pedidos
// =====================================================

export type DemandInput = {

  consumptionTrend: number
  priceElasticityShift: number
  orderVolatility: number

}


// =====================================================
// DEMAND SIGNAL
//
// Señales sistémicas derivadas.
//
// demandMomentum → presión estructural de demanda
// volatility → inestabilidad del mercado
// elasticityShift → cambio en sensibilidad a precio
// =====================================================

export type DemandSignal = {

  demandMomentum: number
  volatility: number
  elasticityShift: number

}


// =====================================================
// COMPUTE DEMAND SIGNAL
//
// Convierte datos de mercado en señales
// normalizadas para el sistema.
// =====================================================

export function computeDemandSignal(
  input: DemandInput
): DemandSignal {

  // -----------------------------------------------------
  // DEMAND MOMENTUM
  // -----------------------------------------------------

  const demandMomentum =
    input.consumptionTrend * 0.6 +
    input.priceElasticityShift * 0.4

  // -----------------------------------------------------
  // VOLATILITY
  // -----------------------------------------------------

  const volatility =
    Math.max(0, Math.min(1, input.orderVolatility))

  // -----------------------------------------------------
  // ELASTICITY SHIFT
  // -----------------------------------------------------

  const elasticityShift =
    Math.max(-1, Math.min(1, input.priceElasticityShift))

  return {

    demandMomentum,
    volatility,
    elasticityShift

  }

}