// =====================================================
// SPATIAL MARKET ORCHESTRATOR
//
// Convierte el estado físico del engine en
// un mercado global.
//
// Pipeline:
//
// 1. Regional markets
// 2. Logistics network
// 3. Spatial price surface
// 4. Commodity flows
// 5. Export opportunities
//
// No modifica la física del motor.
// Solo construye la capa económica.
// =====================================================

// =====================================================
// SPATIAL MARKET ORCHESTRATOR
// =====================================================

import type { EngineState } from "@/engine/core/runtime"

import { buildRegionalMarkets }
from "@/spatialMarket/registries/regionRegistry"

import { buildLogisticsNetwork }
from "@/spatialMarket/logistics/logisticsNetwork"

import { computeSpatialPrices }
from "@/spatialMarket/pricing/spatialPriceEngine"

import { computeCommodityFlows }
from "@/spatialMarket/flows/commodityFlowEngine"

import { computeExportOpportunities }
from "@/spatialMarket/export/exportOpportunityEngine"

import { propagateSupplyShock }
from "@/spatialMarket/cascade/shockPropagation"

import { buildCommodityGraph }
from "@/spatialMarket/graph/commodityGraph"

import { updateRegionInventories }
from "@/spatialMarket/regions/regionInventoryEngine"



export function runSpatialMarket(
  state: EngineState
) {

  // =====================================================
  // LAYER 1 — REGIONAL MARKET STATE
  // =====================================================

  const regions =
    buildRegionalMarkets(state)

  // =====================================================
  // REGION INVENTORY LAYER
  // =====================================================

updateRegionInventories(
  state,
  regions
)


  // =====================================================
  // LAYER 2 — GLOBAL LOGISTICS NETWORK
  // =====================================================

  const logistics =
    buildLogisticsNetwork()


  // =====================================================
  // LAYER 3 — SPATIAL PRICE SURFACE
  // =====================================================

  const prices =
    computeSpatialPrices(
      regions,
      logistics,
      state
    )


  // =====================================================
  // LAYER 4 — COMMODITY FLOWS
  // =====================================================

  const flows =
    computeCommodityFlows(
      regions,
      logistics,
      prices
    )

  // =====================================================
  // GLOBAL COMMODITY GRAPH
  // =====================================================

const graph =
  buildCommodityGraph(
    regions,
    flows
  )

  // =====================================================
  // CASCADE PROPAGATION
  // =====================================================

const cascadeStress =
  propagateSupplyShock(
    state,
    flows
  )


  // =====================================================
  // LAYER 5 — EXPORT OPPORTUNITY SCANNER
  // =====================================================

  const exportOpp =
    computeExportOpportunities(
      regions,
      prices,
      logistics
    )


  // =====================================================
  // WRITE RESULT TO ENGINE STATE
  // =====================================================

  state.spatialMarket = {

    regions,
    logistics,
    prices,
    flows,
    exportOpportunities: exportOpp,
    cascadeStress,
    graph,

  }

}