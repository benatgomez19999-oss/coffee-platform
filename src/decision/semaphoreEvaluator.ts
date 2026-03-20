import { suggestVolume } from "./volumeSuggestion"

// =====================================================
// SEMAPHORE EVALUATOR — ADAPTIVE
// Protección estructural contra vaciado del sistema
// =====================================================

export type SemaphoreStatus =
  | "green"
  | "yellow"
  | "red"

export interface SemaphoreInput {

  requestedVolume: number
  availableNow: number
  forecastIncoming: number

  riskScore: number
  clientPriority: number

  safetyBuffer: number
  adaptiveStress: number

}

export interface SemaphoreResult {

  status: SemaphoreStatus
  confidence: number
  suggestedVolume?: number
  reason: string

}

const clamp01 = (x: number) =>
  Math.max(0, Math.min(1, x))


export function evaluateSemaphore(
  input: SemaphoreInput
): SemaphoreResult {

  const {
    requestedVolume,
    availableNow,
    forecastIncoming,
    riskScore,
    clientPriority,
    safetyBuffer,
    adaptiveStress
  } = input

  // =====================================================
  // EFFECTIVE STOCK
  // =====================================================

  const effectiveNow =
    Math.max(0, availableNow - safetyBuffer)

  // =====================================================
  // FORECAST WEIGHT
  // =====================================================

  const forecastWeight =
    1 - adaptiveStress * 0.7

  const forecastCapacity =
    forecastIncoming * forecastWeight

  // =====================================================
  // POST TRADE STOCK
  // =====================================================

  const postTradeStock =
    effectiveNow - requestedVolume

  // =====================================================
  // CAPACITY BANDS
  // =====================================================

 const minimumReserve = 400

  const yellowLimit =
    effectiveNow + forecastCapacity * 0.3

  const redLimit =
    effectiveNow + forecastCapacity * 0.5

  const margin =
    (effectiveNow + forecastCapacity) - requestedVolume

  const confidence =
    clamp01(margin / Math.max(requestedVolume, 1))

  // =====================================================
  // GREEN
  // =====================================================

  if (

  requestedVolume <= effectiveNow &&
  postTradeStock > minimumReserve &&
  riskScore < 0.4 + adaptiveStress * 0.3

) {

  return {

    status: "green",
    confidence,
    reason: "Approved — safe post-trade reserve maintained"

  }



  }

  // =====================================================
  // STRUCTURAL RED
  // =====================================================

  if (requestedVolume > redLimit) {

    const suggestion = suggestVolume({

      requestedVolume,
      availableCapacity: effectiveNow,
      forecastBuffer: forecastIncoming,
      clientPriority

    })

    return {

      status: "red",
      confidence: suggestion.confidence,
      suggestedVolume: suggestion.suggestedVolume,
      reason: "Rejected — exceeds structural supply capacity"

    }

  }

  // =====================================================
  // YELLOW
  // =====================================================

  if (requestedVolume <= yellowLimit) {

    const suggestion = suggestVolume({

      requestedVolume,
      availableCapacity: effectiveNow,
      forecastBuffer: forecastIncoming,
      clientPriority

    })

    return {

      status: "yellow",
      confidence: suggestion.confidence,
      suggestedVolume: suggestion.suggestedVolume,
      reason: "Limited capacity — counteroffer recommended"

    }

  }

  // =====================================================
  // FALLBACK RED
  // =====================================================

  const suggestion = suggestVolume({

    requestedVolume,
    availableCapacity: effectiveNow,
    forecastBuffer: forecastIncoming,
    clientPriority

  })

  return {

    status: "red",
    confidence: suggestion.confidence,
    suggestedVolume: suggestion.suggestedVolume,
    reason: "Rejected — insufficient supply"

  }

}