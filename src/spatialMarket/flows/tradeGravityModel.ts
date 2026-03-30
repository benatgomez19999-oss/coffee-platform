// =====================================================
// TRADE GRAVITY MODEL
//
// Calcula intensidad potencial de comercio entre
// dos regiones.
//
// Factores:
//
// - diferencia de precios
// - estrés de inventario
// - fricción logística
//
// Inspirado en modelos reales de comercio internacional.
// =====================================================

import type { RegionMarket }
from "@/spatialMarket/regions/regionTypes"



// =====================================================
// TRADE GRAVITY FUNCTION
// =====================================================

export function computeTradeGravity(

  origin: RegionMarket,
  destination: RegionMarket,
  originPrice: number,
  destinationPrice: number,
  logisticsCost: number

) {

  // -------------------------------------------------
  // PRICE ARBITRAGE SIGNAL
  // -------------------------------------------------

  const priceGap =
    destinationPrice - originPrice


  if (priceGap <= 0) return 0


  // -------------------------------------------------
  // INVENTORY IMBALANCE
  // -------------------------------------------------

  const originStress =
    origin.inventoryStress ?? 0

  const destinationStress =
    destination.inventoryStress ?? 0


  const imbalance =
    destinationStress -
    originStress


  // -------------------------------------------------
  // BASE GRAVITY
  // -------------------------------------------------

  let gravity =

    priceGap *

    (1 + imbalance * 0.6)


  // -------------------------------------------------
  // LOGISTICS FRICTION
  // -------------------------------------------------

  gravity =
    gravity /
    (1 + logisticsCost)


  // -------------------------------------------------
  // CLAMP
  // -------------------------------------------------

  gravity =
    Math.max(0, gravity)


  return gravity

}