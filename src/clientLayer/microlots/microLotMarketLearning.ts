// =====================================================
// MICROLOT MARKET LEARNING ENGINE
//
// Aprende del comportamiento real del mercado
// y genera inteligencia comercial.
//
// Registra:
//
// - ventas
// - bids
// - rechazos
// - tiempos de respuesta
//
// Esto permite estimar:
//
// - demanda por origen
// - elasticidad de precio
// - clientes premium
// =====================================================

export type MicroLotMarketEvent =

  | "offer_sent"
  | "offer_accepted"
  | "offer_rejected"
  | "auction_bid"
  | "auction_win"

export type MarketLearningRecord = {

  microLotId: string
  clientId: string

  origin: string

  pricePerKg: number

  volumeKg: number

  event: MicroLotMarketEvent

  timestamp: number

}

export type MarketLearningState = {

  records: MarketLearningRecord[]

}

// =====================================================
// INITIAL MARKET STATE
// =====================================================

export function createMarketLearningState(): MarketLearningState {

  return {

    records: []

  }

}

// =====================================================
// RECORD MARKET EVENT
// =====================================================

export function recordMarketEvent(

  state: MarketLearningState,

  record: MarketLearningRecord

) {

  state.records.push(record)

  return state

}

// =====================================================
// COMPUTE ORIGIN DEMAND SCORE
// =====================================================

export function computeOriginDemandScore(

  state: MarketLearningState,

  origin: string

) {

  const relevant = state.records.filter(

    r =>
      r.origin === origin &&
      r.event === "offer_accepted"

  )

  if (relevant.length === 0)
    return 0

  const avgPrice =

    relevant.reduce(
      (sum, r) => sum + r.pricePerKg,
      0
    ) / relevant.length

  return avgPrice

}

// =====================================================
// CLIENT PREMIUM INDEX
// =====================================================

export function computeClientPremiumIndex(

  state: MarketLearningState,

  clientId: string

) {

  const bids = state.records.filter(

    r =>
      r.clientId === clientId &&
      r.event === "auction_bid"

  )

  if (bids.length === 0)
    return 0

  const avgBid =

    bids.reduce(
      (sum, r) => sum + r.pricePerKg,
      0
    ) / bids.length

  return avgBid

}