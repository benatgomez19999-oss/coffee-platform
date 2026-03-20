import type { SupplyContract } from "../layer/contractTypes"

export function evaluateContractSuggestion(
  requestedVolume: number,
  selected: SupplyContract | null
) {

  if (!selected) return null

  const current = selected.monthlyVolumeKg

  const delta = requestedVolume - current

  // Si no hay cambio o es muy pequeño, no mostrar sugerencia
  if (Math.abs(delta) < 25) return null

  return {
    delta,
    suggestedVolume: requestedVolume
  }
}