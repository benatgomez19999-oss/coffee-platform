//////////////////////////////////////////////////////
// 📡 MARKET SIGNAL PROVIDERS — TYPES
//
// Pure types. Importable by both the pure registry / mock
// provider modules and the Prisma-aware preview service.
//
// Provider results convert into the existing
// MarketSignalIngestionCandidate (PRICING-FEED-1) before
// running through validateMarketSignalCandidate. No
// provider may write to the database.
//////////////////////////////////////////////////////

import type {
  MarketSignalIngestionCandidate,
  MarketSignalIngestionDiagnostic,
  NormalizedMarketSignalCandidate,
} from "./marketSignalIngestion.types.ts"

export type MarketSignalProviderId =
  | "mock-delayed-ice"
  | "manual-echo"
  | "barchart-preview"
  | "barchart-settlement-preview"

export type MarketSignalProviderKind =
  | "MOCK"
  | "MANUAL"
  | "EXTERNAL_HTTP"

export type MarketSignalProviderFetchMode = "preview"

export type MarketSignalProviderScenario = "low" | "neutral" | "high"

// ------------------------------------------------------
// Public summary (safe to expose — never carries secrets)
// ------------------------------------------------------

export type MarketSignalProviderSummary = {
  id: MarketSignalProviderId
  label: string
  kind: MarketSignalProviderKind
  description: string
  requiresApiKey: boolean
  configured: boolean
}

// ------------------------------------------------------
// Fetch result
// ------------------------------------------------------

export type MarketSignalProviderResultOk = {
  ok: true
  providerId: MarketSignalProviderId
  providerKind: MarketSignalProviderKind
  fetchedAt: string
  candidate: MarketSignalIngestionCandidate
  raw: unknown
  diagnostics: MarketSignalIngestionDiagnostic[]
}

export type MarketSignalProviderResultErr = {
  ok: false
  providerId: MarketSignalProviderId
  providerKind: MarketSignalProviderKind
  fetchedAt: string
  raw: unknown
  diagnostics: MarketSignalIngestionDiagnostic[]
}

export type MarketSignalProviderResult =
  | MarketSignalProviderResultOk
  | MarketSignalProviderResultErr

// ------------------------------------------------------
// Provider interface
// ------------------------------------------------------

// ------------------------------------------------------
// Minimal fetch interface for dependency injection
// (kept narrow on purpose so tests can mock without the
// full lib.dom Response shape)
// ------------------------------------------------------

export type ProviderFetchInit = {
  method?: string
  headers?: Record<string, string>
  signal?: AbortSignal
}

export type ProviderFetchResponse = {
  ok: boolean
  status: number
  text(): Promise<string>
}

export type ProviderFetchImpl = (
  input: string,
  init?: ProviderFetchInit,
) => Promise<ProviderFetchResponse>

export type MarketSignalProviderFetchOptions = {
  apiKey?: string | null
  now?: Date
  scenario?: MarketSignalProviderScenario
  /**
   * Inject a fetch implementation for tests / alternate runtimes.
   * Production paths default to globalThis.fetch.
   */
  fetchImpl?: ProviderFetchImpl
  /**
   * Override the AbortController timeout in milliseconds.
   * Defaults to 8_000 ms.
   */
  timeoutMs?: number
}

export type MarketSignalProvider = {
  id: MarketSignalProviderId
  label: string
  kind: MarketSignalProviderKind
  description: string
  requiresApiKey: boolean
  /**
   * Indicates whether the runtime environment has whatever the
   * provider needs to actually return a candidate. Mock providers
   * return `true` always; external providers gate on env keys.
   */
  isConfigured: () => boolean
  fetchLatest(options?: MarketSignalProviderFetchOptions): Promise<MarketSignalProviderResult>
}

// ------------------------------------------------------
// Preview service result (composed by the orchestrator)
// ------------------------------------------------------

export type MarketSignalProviderPreviewValidation =
  | { ok: true; candidate: NormalizedMarketSignalCandidate }
  | { ok: false; diagnostics: MarketSignalIngestionDiagnostic[] }

export type MarketSignalProviderPreview = {
  generatedAt: string
  provider: MarketSignalProviderSummary | null
  providerResult: MarketSignalProviderResult | null
  validation: MarketSignalProviderPreviewValidation | null
  previewCandidate: NormalizedMarketSignalCandidate | null
  diagnostics: MarketSignalIngestionDiagnostic[]
  canApply: boolean
}

// ------------------------------------------------------
// Diagnostic codes (provider-layer)
// ------------------------------------------------------

export const MSP_DIAGNOSTIC_CODES = {
  MSP_PROVIDER_NOT_FOUND:           "MSP_PROVIDER_NOT_FOUND",
  MSP_PROVIDER_FETCH_FAILED:        "MSP_PROVIDER_FETCH_FAILED",
  MSP_PROVIDER_NOT_CONFIGURED:      "MSP_PROVIDER_NOT_CONFIGURED",
  MSP_PROVIDER_RESPONSE_MALFORMED:  "MSP_PROVIDER_RESPONSE_MALFORMED",
  MSP_PROVIDER_UNSUPPORTED_UNIT:    "MSP_PROVIDER_UNSUPPORTED_UNIT",
  MSP_PROVIDER_CANDIDATE_CREATED:   "MSP_PROVIDER_CANDIDATE_CREATED",
  MSP_PROVIDER_MOCK_USED:           "MSP_PROVIDER_MOCK_USED",
  MSP_PROVIDER_VALIDATED:           "MSP_PROVIDER_VALIDATED",
  MSP_PROVIDER_PREVIEW_ONLY:        "MSP_PROVIDER_PREVIEW_ONLY",
  MSP_PROVIDER_DEFERRED_LIVE_FETCH: "MSP_PROVIDER_DEFERRED_LIVE_FETCH",
  // Barchart parser / fetch (PRICING-FEED-2B)
  MSP_BARCHART_STATUS_ERROR:        "MSP_BARCHART_STATUS_ERROR",
  MSP_BARCHART_EMPTY_RESULTS:       "MSP_BARCHART_EMPTY_RESULTS",
  MSP_BARCHART_PRICE_MISSING:       "MSP_BARCHART_PRICE_MISSING",
  MSP_BARCHART_PRICE_INVALID:       "MSP_BARCHART_PRICE_INVALID",
  MSP_BARCHART_TIMESTAMP_INVALID:   "MSP_BARCHART_TIMESTAMP_INVALID",
  MSP_BARCHART_SYMBOL_MISSING:      "MSP_BARCHART_SYMBOL_MISSING",
  MSP_BARCHART_PARSED:              "MSP_BARCHART_PARSED",
  MSP_DEMAND_INDEX_DEFAULTED:       "MSP_DEMAND_INDEX_DEFAULTED",
  // Settlement / EOD provider (PRICING-FEED-2C)
  MSP_BARCHART_SETTLEMENT_FINAL:           "MSP_BARCHART_SETTLEMENT_FINAL",
  MSP_BARCHART_SETTLEMENT_NOT_FINAL:       "MSP_BARCHART_SETTLEMENT_NOT_FINAL",
  MSP_BARCHART_SETTLEMENT_STATUS_UNKNOWN:  "MSP_BARCHART_SETTLEMENT_STATUS_UNKNOWN",
  MSP_BARCHART_SETTLEMENT_FALLBACK_TO_LAST: "MSP_BARCHART_SETTLEMENT_FALLBACK_TO_LAST",
  MSP_BARCHART_SETTLEMENT_PRICE_SELECTED:  "MSP_BARCHART_SETTLEMENT_PRICE_SELECTED",
} as const

export type MspDiagnosticCode =
  (typeof MSP_DIAGNOSTIC_CODES)[keyof typeof MSP_DIAGNOSTIC_CODES]
