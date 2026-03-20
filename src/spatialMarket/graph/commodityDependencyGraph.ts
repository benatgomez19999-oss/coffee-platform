// =====================================================
// COMMODITY DEPENDENCY GRAPH
//
// Representa dependencias estructurales entre commodities.
//
// Ejemplo:
//
// oil → shipping
// oil → fertilizer
// fertilizer → wheat
// shipping → coffee
//
// Permite modelar:
//
// - propagación de shocks
// - contagio de supply stress
// - cascadas de precios
//
// Esta red es diferente del CommodityGraph espacial:
//
// CommodityGraph → regiones + flujos
// DependencyGraph → relaciones económicas
// =====================================================


/* =====================================================
DEPENDENCY TYPES
===================================================== */

export type CommodityDependencyEdge = {

  // commodity origen del shock
  from: string

  // commodity impactada
  to: string

  // intensidad de propagación
  // 0..1
  weight: number

}


/* =====================================================
GLOBAL DEPENDENCY GRAPH
===================================================== */

export const commodityDependencyGraph: CommodityDependencyEdge[] = [

  // ---------------------------------------------------
  // ENERGY → LOGISTICS
  // ---------------------------------------------------

  {
    from: "oil",
    to: "shipping",
    weight: 0.6
  },


  // ---------------------------------------------------
  // ENERGY → FERTILIZER
  // ---------------------------------------------------

  {
    from: "oil",
    to: "fertilizer",
    weight: 0.5
  },


  // ---------------------------------------------------
  // FERTILIZER → AGRICULTURE
  // ---------------------------------------------------

  {
    from: "fertilizer",
    to: "wheat",
    weight: 0.5
  },

  {
    from: "fertilizer",
    to: "corn",
    weight: 0.4
  },

  {
    from: "fertilizer",
    to: "soy",
    weight: 0.4
  },


  // ---------------------------------------------------
  // SHIPPING → SOFT COMMODITIES
  // ---------------------------------------------------

  {
    from: "shipping",
    to: "coffee",
    weight: 0.3
  },

  {
    from: "shipping",
    to: "cocoa",
    weight: 0.3
  },

  {
    from: "shipping",
    to: "sugar",
    weight: 0.25
  },


  // ---------------------------------------------------
  // INDUSTRIAL METALS
  // ---------------------------------------------------

  {
    from: "copper",
    to: "aluminum",
    weight: 0.2
  },

  {
    from: "nickel",
    to: "lithium",
    weight: 0.15
  }

]