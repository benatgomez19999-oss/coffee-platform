// =====================================================
// MICROLOT AUCTION ENGINE
//
// Sistema de subastas privadas para microlotes.
//
// Permite:
//
// - invitar clientes seleccionados
// - recibir bids
// - determinar ganador
//
// Subastas limitadas en tiempo.
// =====================================================

export type MicroLotAuction = {

  auctionId: string

  microLotId: string

  basePricePerKg: number

  startTime: number

  endTime: number

  invitedClients: string[]

  bids: AuctionBid[]

}

export type AuctionBid = {

  clientId: string

  pricePerKg: number

  volumeKg: number

  timestamp: number

}

// =====================================================
// CREATE AUCTION
// =====================================================

export function createMicroLotAuction(

  microLotId: string,

  basePricePerKg: number,

  invitedClients: string[],

  durationHours: number

): MicroLotAuction {

  const now = Date.now()

  return {

    auctionId:
      Math.random().toString(36).slice(2),

    microLotId,

    basePricePerKg,

    startTime: now,

    endTime:
      now + durationHours * 3600000,

    invitedClients,

    bids: []

  }

}

// =====================================================
// PLACE BID
// =====================================================

export function placeAuctionBid(

  auction: MicroLotAuction,

  bid: AuctionBid

) {

  if (Date.now() > auction.endTime)
    return auction

  if (
    !auction.invitedClients.includes(
      bid.clientId
    )
  )
    return auction

  auction.bids.push(bid)

  return auction

}

// =====================================================
// DETERMINE WINNER
// =====================================================

export function determineAuctionWinner(
  auction: MicroLotAuction
) {

  if (auction.bids.length === 0)
    return null

  const sorted = [...auction.bids].sort(

    (a, b) =>

      b.pricePerKg - a.pricePerKg

  )

  return sorted[0]

}