type Region = {
  name: string
  availableKg: number
  capacityKg: number
}

type CapacityFrontier = {
  greenLimit: number
  yellowLimit: number
  effectiveMax: number
}

export function computeCapacityFrontier(
  regions: Region[],
  globalAvailable: number,
  riskScore: number
): CapacityFrontier {

  if (!regions || regions.length === 0) {
    return {
      greenLimit: globalAvailable * 0.65,
      yellowLimit: globalAvailable * 0.9,
      effectiveMax: globalAvailable
    }
  }

  // límite regional (anti-vaciado)
  const regionalLimit =
    Math.min(...regions.map(r => r.availableKg))

  // límite de riesgo
  const riskLimit =
    globalAvailable * (1 - riskScore * 0.3)

  // frontera real del sistema
  const effectiveMax =
    Math.min(globalAvailable, regionalLimit, riskLimit)

  return {

    greenLimit: effectiveMax * 0.65,

    yellowLimit: effectiveMax * 0.9,

    effectiveMax

  }

}