// =====================================================
// CLIENT REPUTATION DRIFT ENGINE
//
// Ajusta el trustScore con el paso del tiempo
// incluso si no hay eventos explícitos.
//
// Detecta:
//
// - clientes que desaparecen
// - clientes que crecen
// - clientes con actividad irregular
//
// =====================================================

import type { ClientTrustState } from "./clientTrustEngine"

export type ClientActivityMetrics = {

  monthsSinceLastOrder: number

  recentOrderVolumeKg: number

  historicalAverageVolumeKg: number

}

// =====================================================
// APPLY REPUTATION DRIFT
// =====================================================

export function applyReputationDrift(

  trust: ClientTrustState,

  activity: ClientActivityMetrics

): ClientTrustState {

  let nextTrust = trust.trustScore

  // -----------------------------------------------------
  // INACTIVITY DECAY
  // -----------------------------------------------------

  if (activity.monthsSinceLastOrder > 3) {

    const inactivityPenalty =
      Math.min(
        0.2,
        activity.monthsSinceLastOrder * 0.01
      )

    nextTrust -= inactivityPenalty

  }

  // -----------------------------------------------------
  // POSITIVE MOMENTUM
  // cliente comprando más volumen
  // -----------------------------------------------------

  if (activity.historicalAverageVolumeKg > 0) {

    const volumeRatio =
      activity.recentOrderVolumeKg /
      activity.historicalAverageVolumeKg

    if (volumeRatio > 1.2) {

      nextTrust += 0.03

    }

    if (volumeRatio < 0.6) {

      nextTrust -= 0.04

    }

  }

  // -----------------------------------------------------
  // BOUND SCORE
  // -----------------------------------------------------

  nextTrust = Math.max(0, Math.min(1, nextTrust))

  return {

    ...trust,

    trustScore: nextTrust

  }

}