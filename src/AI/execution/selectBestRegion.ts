// =====================================================
// SELECT BEST REGION
//
// Selecciona la región con mayor disponibilidad
// para ejecutar una operación.
// =====================================================

import type { EngineState }
from "@/engine/core/runtime"

export function selectBestRegion(

  state: EngineState

) {

  const regions = state.regions ?? []

  if (!regions.length) return null

  let best = regions[0]

  for (const region of regions) {

    if (region.availableKg > best.availableKg) {

      best = region

    }

  }

  return best

}