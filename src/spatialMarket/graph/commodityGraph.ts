// =====================================================
// GLOBAL COMMODITY GRAPH
//
// Representa el mercado global como red.
//
// Nodes → regiones
// Edges → flujos comerciales
//
// Permite análisis de:
//
// - hubs críticos
// - cuellos de botella
// - propagación de shocks
// =====================================================

import type { RegionMarket } from "../regions/regionRegistry"
import type { CommodityFlow } from "../flows/commodityFlowEngine"



/* =====================================================
GRAPH TYPES
===================================================== */

export type CommodityNode = {

  id: string

  supply: number

  utilization: number

  supplyStress: number

}

export type CommodityEdge = {

  from: string

  to: string

  volume: number

  margin: number

}

export type CommodityGraph = {

  nodes: CommodityNode[]

  edges: CommodityEdge[]

}



/* =====================================================
BUILD GRAPH
===================================================== */

export function buildCommodityGraph(

  regions: RegionMarket[],

  flows: CommodityFlow[]

): CommodityGraph {

  const nodes: CommodityNode[] = []

  const edges: CommodityEdge[] = []


  /* -----------------------------------------------
  BUILD NODES
  ----------------------------------------------- */

  for (const region of regions) {

    nodes.push({

      id: region.name,

      supply: region.exportableVolume,

      utilization: region.utilization,

      supplyStress: region.supplyStress

    })

  }


  /* -----------------------------------------------
  BUILD EDGES
  ----------------------------------------------- */

  for (const flow of flows) {

    edges.push({

      from: flow.from,

      to: flow.to,

      volume: flow.volume,

      margin: flow.margin

    })

  }


  return {

    nodes,

    edges

  }

}