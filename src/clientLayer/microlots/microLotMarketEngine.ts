// =====================================================
// MICROLOT MARKET ENGINE
//
// Simula comportamiento del mercado para microlotes.
//
// Estima:
//
// - probabilidad de aceptación
// - sensibilidad al precio
// - tiempo esperado de respuesta
//
// Permite optimizar el orden de ofertas.
// =====================================================

export type MicroLotMarketInput = {

  clientScore: number

  pricePerKg: number

  marketPricePerKg: number

  microLotAffinity: number

  trustScore: number

}

export type MicroLotMarketPrediction = {

  acceptanceProbability: number

  expectedResponseHours: number

  priceSensitivity: number

}

// =====================================================
// COMPUTE ACCEPTANCE PROBABILITY
// =====================================================

export function computeAcceptanceProbability(

  input: MicroLotMarketInput

): number {

  const priceRatio =
    input.marketPricePerKg > 0
      ? input.pricePerKg / input.marketPricePerKg
      : 1

  const pricePenalty =
    Math.max(0, priceRatio - 1)

  const probability =

    input.clientScore * 0.4 +
    input.microLotAffinity * 0.3 +
    input.trustScore * 0.2 -
    pricePenalty * 0.3

  return Math.max(0, Math.min(1, probability))

}

// =====================================================
// COMPUTE RESPONSE TIME
// =====================================================

export function computeResponseTime(

  input: MicroLotMarketInput

): number {

  const baseHours = 24

  const speedFactor =
    input.clientScore * 0.5 +
    input.trustScore * 0.5

  const response =
    baseHours * (1 - speedFactor * 0.7)

  return Math.max(2, response)

}

// =====================================================
// COMPUTE PRICE SENSITIVITY
// =====================================================

export function computePriceSensitivity(

  input: MicroLotMarketInput

): number {

  const sensitivity =

    (1 - input.clientScore) * 0.4 +
    (1 - input.trustScore) * 0.3 +
    (1 - input.microLotAffinity) * 0.3

  return Math.max(0, Math.min(1, sensitivity))

}

// =====================================================
// FULL MARKET PREDICTION
// =====================================================

export function predictMicroLotMarket(

  input: MicroLotMarketInput

): MicroLotMarketPrediction {

  const acceptanceProbability =
    computeAcceptanceProbability(input)

  const expectedResponseHours =
    computeResponseTime(input)

  const priceSensitivity =
    computePriceSensitivity(input)

  return {

    acceptanceProbability,

    expectedResponseHours,

    priceSensitivity

  }

}