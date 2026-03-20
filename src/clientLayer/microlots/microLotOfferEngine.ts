// =====================================================
// MICROLOT OFFER ENGINE
//
// Motor de asignación de microlotes especiales.
//
// Selecciona clientes elegibles y genera una lista
// priorizada de ofertas basada en:
//
// - ClientScore
// - disponibilidad del microlote
// - afinidad del cliente
//
// El ranking NO es visible para el cliente.
// =====================================================

import { computeClientScore } from "../scoring/clientScoreEngine"

export type MicroLot = {

  id: string
  origin: string
  variety: string

  totalKg: number

  minAllocationKg: number

}

export type ClientCandidate = {

  id: string

  metrics: any

}

export type MicroLotOffer = {

  clientId: string

  score: number

  proposedVolumeKg: number

}

// =====================================================
// GENERATE MICROLOT OFFERS
// =====================================================

export function generateMicroLotOffers(

  microLot: MicroLot,

  clients: ClientCandidate[]

): MicroLotOffer[] {

  const scoredClients = clients.map(client => {

    const scoreResult =
      computeClientScore(client.metrics)

    return {

      clientId: client.id,

      score: scoreResult.score

    }

  })

  // -----------------------------------------------------
  // SORT CLIENTS BY SCORE
  // -----------------------------------------------------

  scoredClients.sort(
    (a, b) => b.score - a.score
  )

  // -----------------------------------------------------
  // ALLOCATION LOGIC
  // -----------------------------------------------------

  const offers: MicroLotOffer[] = []

  let remaining = microLot.totalKg

  for (const client of scoredClients) {

    if (remaining < microLot.minAllocationKg)
      break

    const allocation =
      Math.min(
        microLot.minAllocationKg,
        remaining
      )

    offers.push({

      clientId: client.clientId,

      score: client.score,

      proposedVolumeKg: allocation

    })

    remaining -= allocation

  }

  return offers

}