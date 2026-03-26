// =====================================================
// GLOBAL LOGISTICS NETWORK
//
// Modelo simplificado de la red logística global.
//
// Representa:
//
// - fricción logística global
// - coste base de transporte
// - congestión sistémica
// - riesgo de interrupción
//
// Este módulo no calcula rutas específicas aún.
// Solo genera el estado logístico global.
// =====================================================

import type { EngineState } from "@/engine/core/runtime"



// =====================================================
// LOGISTICS NETWORK TYPE
// =====================================================

export type LogisticsNetwork = {

  globalFriction: number

  congestion: number

  transportCostBase: number

  disruptionRisk: number

}



// =====================================================
// BUILD LOGISTICS NETWORK
//
// Construye el estado logístico global
// basado en señales del engine.
// =====================================================

export function buildLogisticsNetwork(): LogisticsNetwork {

  // Por ahora usamos valores base.
  // En versiones futuras se conectará con:
  // weather
  // ports
  // shipping routes

  const network: LogisticsNetwork = {

    globalFriction: 0.1,

    congestion: 0.2,

    transportCostBase: 20,

    disruptionRisk: 0.05

  }

  return network

}