//////////////////////////////////////////////////////
// 📈 MARKET SIGNAL TICK — TYPES
//
// Pure types for the append-only MarketSignalTick history.
// Recording a tick NEVER updates the active MarketSignalSnapshot,
// PricingSnapshot.clientB2BPricePerKg, Contract.lockedPricePerKg
// or DemandIntent.previewPricePerKg. See marketSignalTick.pure.ts
// for validation + builders, marketSignalTick.service.ts for the
// Prisma-backed writer + lister.
//////////////////////////////////////////////////////

import type { MarketSignalInputSource } from "./marketSignalIngestion.types.ts"

export type MarketSignalTickInput = {
  providerId: string
  providerKind: string
  source: MarketSignalInputSource
  cPrice: number
  demandIndex?: number | null
  confidence?: string | null
  rawUnit?: string | null
  rawValue?: number | null
  symbol?: string | null
  contractMonth?: string | null
  capturedAt?: Date | string | null
  validFrom?: Date | string | null
  expiresAt?: Date | string | null
  sourceName?: string | null
  sourceUrl?: string | null
  note?: string | null
  diagnostics?: unknown
  rawPayload?: unknown
}

export type MarketSignalTickDiagnostic = {
  code: string
  severity: "info" | "warning" | "error"
  message: string
}

export type NormalizedMarketSignalTick = {
  providerId: string
  providerKind: string
  source: MarketSignalInputSource

  cPrice: number
  demandIndex: number | null
  confidence: string | null
  rawUnit: string | null
  rawValue: number | null

  symbol: string | null
  contractMonth: string | null

  capturedAt: Date
  validFrom: Date | null
  expiresAt: Date | null

  sourceName: string | null
  sourceUrl: string | null
  note: string | null

  diagnostics: unknown
  rawPayload: unknown
}

export type MarketSignalTickValidationResult =
  | {
      ok: true
      tick: NormalizedMarketSignalTick
      diagnostics: MarketSignalTickDiagnostic[]
    }
  | {
      ok: false
      diagnostics: MarketSignalTickDiagnostic[]
    }

// ------------------------------------------------------
// IN-BAND RANGES (must agree with FEED-1 validator)
// ------------------------------------------------------

export const MST_CPRICE_MIN = 50
export const MST_CPRICE_MAX = 600
export const MST_DEMAND_MIN = 0.8
export const MST_DEMAND_MAX = 1.2

export const MST_VALID_SOURCES: ReadonlyArray<MarketSignalInputSource> = [
  "MANUAL",
  "API_FEED",
  "INTERNAL_COMPUTE",
  "AI_SYSTEM",
]

// ------------------------------------------------------
// REDACTION KEYS
//
// Recursive walk of rawPayload + diagnostics replaces values
// for any object key that case-insensitively matches one of
// these tokens. Best-effort: if a provider ever embeds a key
// inside a string blob we won't catch it without context.
// ------------------------------------------------------

export const MST_SECRET_KEY_PATTERNS: ReadonlyArray<string> = [
  "apikey",
  "api_key",
  "api-key",
  "token",
  "secret",
  "authorization",
  "auth",
  "password",
  "bearer",
]

export const MST_REDACTED_PLACEHOLDER = "[REDACTED]"

// ------------------------------------------------------
// SOURCE-URL QUERY PARAM ALLOW LIST
//
// Only these query params are kept in a sanitised sourceUrl.
// Everything else is stripped — including unknown params that
// might carry secrets.
// ------------------------------------------------------

export const MST_ALLOWED_SOURCE_URL_PARAMS: ReadonlyArray<string> = [
  "symbols",
  "symbol",
  "fields",
]
