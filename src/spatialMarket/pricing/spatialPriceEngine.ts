// =====================================================
// SPATIAL PRICE ENGINE
//
// Calcula la superficie de precios global del commodity.
//
// Inputs:
//
// regional markets
// logistics network
// engine state
//
// Output:
//
// price surface by region
// =====================================================

import type { EngineState } from "@/engine/core/runtime"
import type { RegionMarket }
from "../regions/regionTypes"


// =====================================================
// PRICE SURFACE TYPE
// =====================================================

export type SpatialPriceSurface = {

  [region: string]: number

}



// =====================================================
// BASE PRICE MODEL
//
// Precio base estructural del commodity.
// =====================================================

function computeBasePrice(
  state: EngineState
) {

  const energy =
    state.systemEnergy ?? 0

  const fatigue =
    state.systemFatigue ?? 0

  const basePrice =
    100 *
    (1 + energy * 0.4) *
    (1 + fatigue * 0.3)

  return basePrice

}



// =====================================================
// SYSTEMIC RISK PREMIUM
//
// Prima de riesgo basada en early warning signals.
// =====================================================

function computeRiskPremium(
  state: EngineState
) {

  const collapse =
    state.collapseProbability ?? 0

  const slowing =
    state.criticalSlowing ?? 0

  const lyapunov =
    state.lyapunovIndicator ?? 0

  const premium =
    collapse * 30 +
    slowing * 20 +
    lyapunov * 10

  return premium

}



// =====================================================
// SPATIAL PRICE COMPUTATION
// =====================================================

export function computeSpatialPrices(
  regions: RegionMarket[],
  logistics: any,
  state: EngineState
): SpatialPriceSurface {

  const prices: SpatialPriceSurface = {}

  const basePrice =
    computeBasePrice(state)


  const riskPremium =
    computeRiskPremium(state)

 for (const region of regions) {

  const utilization =
    region.utilization ?? 0

  const supplyStress =
    region.supplyStress ?? 0

  const inventoryStress =
    region.inventoryStress ?? 0


  // -------------------------------------------------
  // LOCAL SUPPLY PRESSURE
  // -------------------------------------------------

  const supplyPressure =
    utilization * 0.6 +
    supplyStress * 0.4


  // -------------------------------------------------
  // INVENTORY PRESSURE
  // -------------------------------------------------

  const inventoryPressure =
    inventoryStress * 0.35


  // -------------------------------------------------
  // LOGISTICS FRICTION
  // -------------------------------------------------

  const logisticsPenalty =
    logistics?.globalFriction ?? 0


  // -------------------------------------------------
  // FINAL PRICE
  // -------------------------------------------------

  const price =

    basePrice *

    (1 + supplyPressure)

    * (1 + inventoryPressure)

    + logisticsPenalty * 10

    + riskPremium


  prices[region.name] =
    Math.max(1, price)

}

  return prices

}