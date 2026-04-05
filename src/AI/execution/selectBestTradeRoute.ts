// =====================================================
// SELECT BEST TRADE ROUTE
//
// Selecciona la mejor ruta disponible para un commodity
// basándose en margen esperado.
// =====================================================

import type { EngineState }
from "@/src/engine/core/runtime"

export function selectBestTradeRoute(

  state: EngineState,
  commodity: string

) {

  const routes =
    state.globalTradeRoutes ?? []

  const candidates =
    routes.filter(
      r => r.commodity === commodity
    )

  if (!candidates.length) return null

  let best = candidates[0]

  for (const route of candidates) {

    if (
      route.expectedMargin >
      best.expectedMargin
    ) {
      best = route
    }

  }

  return best

}