// =====================================================
// CLIENT SCORE ENGINE
//
// Sistema interno de priorización de clientes.
//
// El score representa la calidad de la relación comercial
// y se utiliza para:
//
// - asignación de microlotes
// - prioridad en ofertas limitadas
// - acceso temprano a cosechas especiales
//
// El score NO es visible para el cliente.
// =====================================================

export type ClientMetrics = {

  // =====================================================
  // RELIABILITY
  // comportamiento de pago y cumplimiento
  // =====================================================

  paymentReliability: number   // 0..1
  contractFulfillment: number  // 0..1

  // =====================================================
  // VOLUME HISTORY
  // volumen total histórico
  // =====================================================

  totalKgPurchased: number

  // =====================================================
  // RELATIONSHIP STABILITY
  // tiempo de relación comercial
  // =====================================================

  monthsActive: number

  // =====================================================
  // MICROLOT AFFINITY
  // historial de compra de microlotes
  // =====================================================

  microLotPurchases: number

  // =====================================================
  // RECENCY
  // tiempo desde última compra
  // =====================================================

  monthsSinceLastOrder: number

  // =====================================================
  // CLIENT SCORE 
  // puntaucion interna de cliente 
  // =====================================================

  trustScore: number

}

export type ClientScoreResult = {

  score: number

  breakdown: {

    reliability: number
    volume: number
    stability: number
    microLotAffinity: number
    recencyPenalty: number

  }

}

// =====================================================
// CLIENT SCORE CALCULATION
// =====================================================

export function computeClientScore(
  metrics: ClientMetrics
): ClientScoreResult {

  // -----------------------------------------------------
  // RELIABILITY
  // -----------------------------------------------------

 const reliability =

  (
    metrics.paymentReliability * 0.4 +
    metrics.contractFulfillment * 0.3 +
    metrics.trustScore * 0.3
  )

  // -----------------------------------------------------
  // VOLUME HISTORY
  // saturación progresiva
  // -----------------------------------------------------

  const volume =
    Math.min(
      1,
      metrics.totalKgPurchased / 20000
    )

  // -----------------------------------------------------
  // RELATIONSHIP STABILITY
  // -----------------------------------------------------

  const stability =
    Math.min(
      1,
      metrics.monthsActive / 36
    )

  // -----------------------------------------------------
  // MICROLOT AFFINITY
  // -----------------------------------------------------

  const microLotAffinity =
    Math.min(
      1,
      metrics.microLotPurchases / 20
    )

  // -----------------------------------------------------
  // RECENCY PENALTY
  // clientes inactivos pierden prioridad
  // -----------------------------------------------------

  const recencyPenalty =
    Math.min(
      1,
      metrics.monthsSinceLastOrder / 24
    )

  // -----------------------------------------------------
  // BASE SCORE
  // -----------------------------------------------------

  let score =

    reliability * 0.35 +
    volume * 0.25 +
    stability * 0.20 +
    microLotAffinity * 0.20

  // -----------------------------------------------------
  // APPLY RECENCY PENALTY
  // -----------------------------------------------------

  score = score * (1 - recencyPenalty * 0.4)

  score = Math.max(0, Math.min(1, score))

  return {

    score,

    breakdown: {

      reliability,
      volume,
      stability,
      microLotAffinity,
      recencyPenalty

    }

  }

}