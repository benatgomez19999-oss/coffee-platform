// =====================================================
// SPATIAL MARKET ORCHESTRATOR
//
// Convierte el estado físico del engine en
// un mercado global.
// =====================================================

// =====================================================
// SPATIAL MARKET ORCHESTRATOR
// =====================================================

import type { EngineState } from "@/engine/core/runtime"

import { buildRegionalMarkets }
from "@/spatialMarket/regions/regionMarketBuilder"

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