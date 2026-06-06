//////////////////////////////////////////////////////
// 📡 MARKET SIGNAL INGESTION — TYPES
//
// Pure types for the controlled ingestion path that
// turns operator/manual/AI inputs into a normalised
// MarketSignalSnapshot row. Used by both the pure
// validator (marketSignalIngestion.pure.ts) and the
// Prisma service (marketSignalIngestion.service.ts).
//////////////////////////////////////////////////////

export type MarketSignalInputSource =
  | "MANUAL"
  | "API_FEED"
  | "INTERNAL_COMPUTE"
  | "AI_SYSTEM"

export type MarketSignalConfidence =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "OPERATOR_VERIFIED"

export type MarketSignalUnit = "US_CENTS_PER_LB"

export type MarketSignalProvenanceInput = {
  provider?: string | null
  sourceName?: string | null
  sourceUrl?: string | null
  retrievedAt?: string | Date | null
  rawValue?: number | null
  rawUnit?: MarketSignalUnit | null
  confidence?: MarketSignalConfidence | null
}

export type MarketSignalIngestionCandidate = {
  cPrice: number
  demandIndex: number
  source: MarketSignalInputSource
  note?: string | null
  validFrom?: string | Date | null
  expiresAt?: string | Date | null
  provenance?: MarketSignalProvenanceInput
}

export type MarketSignalIngestionDiagnosticSeverity =
  | "info"
  | "warning"
  | "error"

export type MarketSignalIngestionDiagnostic = {
  code: string
  severity: MarketSignalIngestionDiagnosticSeverity
  message: string
}

export type NormalizedMarketSignalProvenance = {
  provider: string | null
  sourceName: string | null
  sourceUrl: string | null
  retrievedAt: Date | null
  rawValue: number | null
  rawUnit: MarketSignalUnit
  confidence: MarketSignalConfidence
}

export type NormalizedMarketSignalCandidate = {
  cPrice: number
  demandIndex: number
  source: MarketSignalInputSource
  note: string | null
  validFrom: Date
  expiresAt: Date | null
  provenance: NormalizedMarketSignalProvenance
  diagnostics: MarketSignalIngestionDiagnostic[]
}

export type MarketSignalValidationResult =
  | { ok: true; candidate: NormalizedMarketSignalCandidate }
  | { ok: false; diagnostics: MarketSignalIngestionDiagnostic[] }

// ------------------------------------------------------
// IN-BAND RANGES (must match every other consumer)
//
// cPrice = US cents/lb
// demandIndex = 0.8..1.2 multiplier
// ------------------------------------------------------

export const MSI_CPRICE_MIN = 50
export const MSI_CPRICE_MAX = 600
export const MSI_DEMAND_MIN = 0.8
export const MSI_DEMAND_MAX = 1.2

export const MSI_VALID_SOURCES: ReadonlyArray<MarketSignalInputSource> = [
  "MANUAL",
  "API_FEED",
  "INTERNAL_COMPUTE",
  "AI_SYSTEM",
]

export const MSI_VALID_CONFIDENCES: ReadonlyArray<MarketSignalConfidence> = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "OPERATOR_VERIFIED",
]
