// =====================================================
// MICROLOT OFFER DISPATCHER
//
// Envía ofertas de microlotes a clientes.
//
// Este módulo puede conectarse con:
//
// - email
// - dashboard notifications
// - AI recommendation system
// =====================================================

import { generateMicroLotOffers } from "./microLotOfferEngine"

export function dispatchMicroLotOffers(

  microLot: any,

  clients: any[]

) {

  const offers =
    generateMicroLotOffers(
      microLot,
      clients
    )

  // -----------------------------------------------------
  // GENERATE OFFER EVENTS
  // -----------------------------------------------------

  const events = offers.map(o => ({

    type: "microLotOffer",

    clientId: o.clientId,

    microLotId: microLot.id,

    volumeKg: o.proposedVolumeKg

  }))

  return events

}