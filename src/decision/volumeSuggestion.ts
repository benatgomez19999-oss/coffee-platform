// =====================================================
// VOLUME SUGGESTION ENGINE
// Sugiere volumen alternativo bajo incertidumbre.
// =====================================================

export interface VolumeSuggestionInput {
  requestedVolume: number
  availableCapacity: number
  forecastBuffer: number
  clientPriority: number
}

export interface VolumeSuggestionResult {
  suggestedVolume: number
  confidence: number
}

const clamp01 = (x: number) =>
  Math.max(0, Math.min(1, x))

export function suggestVolume(
  input: VolumeSuggestionInput
): VolumeSuggestionResult {

  const {
    requestedVolume,
    availableCapacity,
    forecastBuffer,
    clientPriority
  } = input

  const effectiveCapacity =
    availableCapacity + forecastBuffer * 0.5

  const coverage =
    requestedVolume > 0
      ? effectiveCapacity / requestedVolume
      : 1

  const priorityBoost =
    1 + clientPriority * 0.15

  const rawSuggestion =
    Math.min(requestedVolume, effectiveCapacity) *
    priorityBoost

  const suggestedVolume =
    Math.max(0, Math.min(rawSuggestion, effectiveCapacity))

  const confidence =
    clamp01(coverage)

  return {
    suggestedVolume,
    confidence
  }

}