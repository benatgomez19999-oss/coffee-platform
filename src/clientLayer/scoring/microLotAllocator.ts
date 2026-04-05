// =====================================================
// MICROLOT ALLOCATION ENGINE
//
// Selecciona clientes elegibles para microlotes.
// Utiliza ClientScore para priorizar.
//
// =====================================================

import { computeClientScore } from "@/src/clientLayer/scoring/clientScoreEngine"

export function rankClientsForMicroLot(clients: any[]) {

  const scoredClients = clients.map(client => {

    const result = computeClientScore(client.metrics)

    return {

      clientId: client.id,

      score: result.score,

      breakdown: result.breakdown

    }

  })

  scoredClients.sort(
    (a, b) => b.score - a.score
  )

  return scoredClients

}