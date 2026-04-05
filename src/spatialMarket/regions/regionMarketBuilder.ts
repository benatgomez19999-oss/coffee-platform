import type { EngineState } from "@/src/engine/core/runtime"
import type { RegionMarket } from "@/src/spatialMarket/regions/regionTypes"

export function buildRegionalMarkets(
  state: EngineState
): RegionMarket[] {

  const regions = state.regions ?? []

  const markets: RegionMarket[] = []

  for (const r of regions) {

    const capacity = Math.max(1, r.capacityKg)
    const available = Math.max(0, r.availableKg)

    const utilization = 1 - (available / capacity)
    const supplyStress = state.supplyStressField ?? 0

    const exportableVolume =
      Math.max(0, available - capacity * 0.3)

    markets.push({
      name: r.name,
      capacityKg: capacity,
      availableKg: available,
      utilization,
      supplyStress,
      exportableVolume
    })
  }

  return markets
}