//////////////////////////////////////////////////////
// 📡 MARKET SIGNAL PROVIDERS — PURE
//
// Provider implementations + registry. No Prisma. No
// runtime DB writes anywhere on this code path. The mock
// provider is fully deterministic. The barchart provider
// is a skeleton: it never makes a live network request in
// this sprint — when an API key is missing it returns a
// structured `MSP_PROVIDER_NOT_CONFIGURED` error; when an
// API key is present it returns `MSP_PROVIDER_DEFERRED_LIVE_FETCH`
// (the live fetch path is gated to PRICING-FEED-2B).
//
// Importable under node --test — no @-aliases.
//////////////////////////////////////////////////////

import {
  MSP_DIAGNOSTIC_CODES,
  type MarketSignalProvider,
  type MarketSignalProviderFetchOptions,
  type MarketSignalProviderId,
  type MarketSignalProviderResult,
  type MarketSignalProviderScenario,
  type MarketSignalProviderSummary,
  type ProviderFetchImpl,
  type ProviderFetchResponse,
} from "./marketSignalProviders.types.ts"
import type {
  MarketSignalIngestionCandidate,
  MarketSignalIngestionDiagnostic,
} from "./marketSignalIngestion.types.ts"
import {
  parseBarchartGetQuoteResponse,
  parseBarchartSettlementResponse,
  type BarchartSettlementPriceField,
} from "./marketSignalBarchart.parser.ts"

// ------------------------------------------------------
// Helper — diagnostic builder
// ------------------------------------------------------

function diag(
  code: keyof typeof MSP_DIAGNOSTIC_CODES,
  severity: "info" | "warning" | "error",
  message: string,
): MarketSignalIngestionDiagnostic {
  return { code: MSP_DIAGNOSTIC_CODES[code], severity, message }
}

function nowIso(date?: Date): string {
  return (date ?? new Date()).toISOString()
}

// ------------------------------------------------------
// MOCK — mock-delayed-ice
//
// Deterministic local provider. No network. No env. No
// Math.random. Three scenarios:
//   low     — easing market
//   neutral — default (≈ recent C-price band)
//   high    — tight market / strong demand
// ------------------------------------------------------

type MockScenarioPayload = {
  cPrice: number
  demandIndex: number
  note: string
}

const MOCK_SCENARIOS: Record<MarketSignalProviderScenario, MockScenarioPayload> = {
  low:     { cPrice: 240, demandIndex: 0.95, note: "Mock: easing market scenario" },
  neutral: { cPrice: 290, demandIndex: 1.10, note: "Mock: neutral scenario (default)" },
  high:    { cPrice: 340, demandIndex: 1.18, note: "Mock: tight-market scenario" },
}

export const mockDelayedIceProvider: MarketSignalProvider = {
  id: "mock-delayed-ice",
  label: "Mock delayed ICE Arabica C",
  kind: "MOCK",
  description:
    "Deterministic local provider — no network, no API key. Returns a plausible cPrice/demandIndex pair under one of three scenarios (low/neutral/high). Safe for tests and offline dev.",
  requiresApiKey: false,
  isConfigured: () => true,
  async fetchLatest(
    options: MarketSignalProviderFetchOptions = {},
  ): Promise<MarketSignalProviderResult> {

    const scenario: MarketSignalProviderScenario = options.scenario ?? "neutral"
    const payload = MOCK_SCENARIOS[scenario] ?? MOCK_SCENARIOS.neutral
    const fetchedAt = nowIso(options.now)

    const candidate: MarketSignalIngestionCandidate = {
      cPrice: payload.cPrice,
      demandIndex: payload.demandIndex,
      source: "API_FEED",
      note: payload.note,
      provenance: {
        provider: "mock-delayed-ice",
        sourceName: "Mock delayed ICE Arabica C",
        sourceUrl: null,
        retrievedAt: fetchedAt,
        rawValue: payload.cPrice,
        rawUnit: "US_CENTS_PER_LB",
        confidence: "MEDIUM",
      },
    }

    return {
      ok: true,
      providerId: "mock-delayed-ice",
      providerKind: "MOCK",
      fetchedAt,
      candidate,
      raw: { scenario, ...payload },
      diagnostics: [
        diag("MSP_PROVIDER_MOCK_USED", "info",
          `Returned deterministic mock candidate for scenario "${scenario}".`),
        diag("MSP_PROVIDER_CANDIDATE_CREATED", "info",
          "Provider produced a MarketSignalIngestionCandidate; no DB writes."),
        diag("MSP_PROVIDER_PREVIEW_ONLY", "info",
          "Preview only — operator must explicitly apply via the manual ingestion form."),
      ],
    }
  },
}

// ------------------------------------------------------
// BARCHART — barchart-preview (live fetch behind env key)
//
//   • No env key  → ok:false MSP_PROVIDER_NOT_CONFIGURED
//                   (no fetch issued)
//   • Env key set → live HTTP request to Barchart OnDemand
//                   getQuote.json with AbortController
//                   timeout. Response goes through
//                   parseBarchartGetQuoteResponse before
//                   becoming a candidate.
//
// API key is NEVER exposed:
//   • not in diagnostics
//   • not in raw payload
//   • not in provenance.sourceUrl (sanitised)
//
// Tests inject `fetchImpl` via options so no real network
// is ever hit during CI / build.
// ------------------------------------------------------

const BARCHART_ENV_VAR = "BARCHART_ONDEMAND_API_KEY"
const BARCHART_BASE_URL_ENV_VAR = "BARCHART_ONDEMAND_BASE_URL"
const BARCHART_SYMBOL_ENV_VAR = "BARCHART_COFFEE_SYMBOL"
const BARCHART_DEFAULT_BASE_URL = "https://ondemand.websol.barchart.com"
const BARCHART_DEFAULT_SYMBOL = "KC*1"
const BARCHART_DEFAULT_TIMEOUT_MS = 8_000
const BARCHART_DEFAULT_FIELDS = [
  "lastPrice", "tradeTimestamp", "serverTimestamp",
  "open", "high", "low", "close", "previousClose",
].join(",")
const BARCHART_PREVIEW_EXPIRES_HOURS = 24

function readEnv(name: string): string | null {
  if (typeof process === "undefined" || !process.env) return null
  const v = process.env[name]
  if (typeof v === "string" && v.trim().length > 0) return v.trim()
  return null
}

function readBarchartApiKey(explicit?: string | null): string | null {
  if (typeof explicit === "string" && explicit.trim().length > 0) {
    return explicit.trim()
  }
  return readEnv(BARCHART_ENV_VAR)
}

function buildBarchartUrls(apiKey: string, symbol: string, baseUrl: string): {
  requestUrl: string
  sanitizedUrl: string
} {
  const requestUrl =
    `${baseUrl}/getQuote.json?apikey=${encodeURIComponent(apiKey)}` +
    `&symbols=${encodeURIComponent(symbol)}` +
    `&fields=${encodeURIComponent(BARCHART_DEFAULT_FIELDS)}`
  // Public-safe URL — never includes the api key.
  const sanitizedUrl =
    `${baseUrl}/getQuote.json?symbols=${encodeURIComponent(symbol)}`
  return { requestUrl, sanitizedUrl }
}

async function fetchBarchartPayloadWithTimeout(input: {
  url: string
  fetchImpl: ProviderFetchImpl
  timeoutMs: number
}): Promise<
  | { ok: true; status: number; body: string }
  | { ok: false; status: number | null; reason: string }
> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), input.timeoutMs)
  try {
    let res: ProviderFetchResponse
    try {
      res = await input.fetchImpl(input.url, { signal: controller.signal })
    } catch (err) {
      const reason =
        err instanceof Error ? err.message : String(err)
      return { ok: false, status: null, reason }
    }
    if (!res.ok) {
      return { ok: false, status: res.status, reason: `HTTP ${res.status}` }
    }
    let body: string
    try {
      body = await res.text()
    } catch (err) {
      return {
        ok: false,
        status: res.status,
        reason: `text() failed: ${err instanceof Error ? err.message : String(err)}`,
      }
    }
    return { ok: true, status: res.status, body }
  } finally {
    clearTimeout(timer)
  }
}

function defaultFetchImpl(): ProviderFetchImpl | null {
  if (typeof globalThis !== "undefined" && typeof (globalThis as any).fetch === "function") {
    const f = (globalThis as any).fetch as typeof fetch
    return ((url, init) => f(url, init as RequestInit) as Promise<ProviderFetchResponse>) as ProviderFetchImpl
  }
  return null
}

export const barchartPreviewProvider: MarketSignalProvider = {
  id: "barchart-preview",
  label: "Barchart OnDemand (preview)",
  kind: "EXTERNAL_HTTP",
  description:
    `Live Barchart OnDemand getQuote fetch behind ${BARCHART_ENV_VAR}. Default symbol KC*1 (overridable via ${BARCHART_SYMBOL_ENV_VAR}). Preview-only — never writes MarketSignalSnapshot or refreshes B2B prices.`,
  requiresApiKey: true,
  isConfigured: () => readBarchartApiKey() != null,
  async fetchLatest(
    options: MarketSignalProviderFetchOptions = {},
  ): Promise<MarketSignalProviderResult> {

    const fetchedAt = nowIso(options.now)
    const now = options.now ?? new Date()
    const apiKey = readBarchartApiKey(options.apiKey)

    // ─── No key → not configured, no fetch ──────────
    if (!apiKey) {
      return {
        ok: false,
        providerId: "barchart-preview",
        providerKind: "EXTERNAL_HTTP",
        fetchedAt,
        raw: null,
        diagnostics: [
          diag(
            "MSP_PROVIDER_NOT_CONFIGURED",
            "error",
            `${BARCHART_ENV_VAR} is not set. Configure it server-side to enable the live fetch path.`,
          ),
          diag(
            "MSP_PROVIDER_PREVIEW_ONLY",
            "info",
            "Provider will never write MarketSignalSnapshot — apply still happens through the manual ingestion form.",
          ),
        ],
      }
    }

    const baseUrl = readEnv(BARCHART_BASE_URL_ENV_VAR) ?? BARCHART_DEFAULT_BASE_URL
    const symbol = readEnv(BARCHART_SYMBOL_ENV_VAR) ?? BARCHART_DEFAULT_SYMBOL
    const timeoutMs = options.timeoutMs ?? BARCHART_DEFAULT_TIMEOUT_MS
    const { requestUrl, sanitizedUrl } = buildBarchartUrls(apiKey, symbol, baseUrl)

    const fetchImpl = options.fetchImpl ?? defaultFetchImpl()
    if (!fetchImpl) {
      return {
        ok: false,
        providerId: "barchart-preview",
        providerKind: "EXTERNAL_HTTP",
        fetchedAt,
        // Sanitised — never includes the api key.
        raw: { sourceUrl: sanitizedUrl, symbol },
        diagnostics: [
          diag(
            "MSP_PROVIDER_FETCH_FAILED",
            "error",
            "No fetch implementation is available in the current runtime and no fetchImpl was injected.",
          ),
          diag(
            "MSP_PROVIDER_PREVIEW_ONLY",
            "info",
            "Provider will never write MarketSignalSnapshot.",
          ),
        ],
      }
    }

    // ─── Live fetch ────────────────────────────────
    const fetched = await fetchBarchartPayloadWithTimeout({
      url: requestUrl,
      fetchImpl,
      timeoutMs,
    })

    if (!fetched.ok) {
      return {
        ok: false,
        providerId: "barchart-preview",
        providerKind: "EXTERNAL_HTTP",
        fetchedAt,
        raw: { sourceUrl: sanitizedUrl, symbol, status: fetched.status },
        diagnostics: [
          diag(
            "MSP_PROVIDER_FETCH_FAILED",
            "error",
            `Barchart fetch failed: ${fetched.reason}.`,
          ),
          diag(
            "MSP_PROVIDER_PREVIEW_ONLY",
            "info",
            "Provider will never write MarketSignalSnapshot.",
          ),
        ],
      }
    }

    // ─── Parse JSON ────────────────────────────────
    let payload: unknown
    try {
      payload = JSON.parse(fetched.body)
    } catch (err) {
      return {
        ok: false,
        providerId: "barchart-preview",
        providerKind: "EXTERNAL_HTTP",
        fetchedAt,
        raw: { sourceUrl: sanitizedUrl, symbol, status: fetched.status, bodyPreview: fetched.body.slice(0, 200) },
        diagnostics: [
          diag(
            "MSP_PROVIDER_RESPONSE_MALFORMED",
            "error",
            `Barchart response is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
          ),
          diag(
            "MSP_PROVIDER_PREVIEW_ONLY",
            "info",
            "Provider will never write MarketSignalSnapshot.",
          ),
        ],
      }
    }

    // ─── Parse + structured diagnostics ────────────
    const parsed = parseBarchartGetQuoteResponse(payload, now)

    if (!parsed.ok) {
      return {
        ok: false,
        providerId: "barchart-preview",
        providerKind: "EXTERNAL_HTTP",
        fetchedAt,
        // Forward the (verified-non-secret) Barchart payload so the
        // operator can inspect what came back. The api key is
        // already absent from the request URL we expose.
        raw: { sourceUrl: sanitizedUrl, symbol, status: fetched.status, payload },
        diagnostics: [
          ...parsed.diagnostics,
          diag(
            "MSP_PROVIDER_PREVIEW_ONLY",
            "info",
            "Provider will never write MarketSignalSnapshot.",
          ),
        ],
      }
    }

    // ─── Success — build candidate ─────────────────
    const validFrom = parsed.timestamp ?? now
    const expiresAt = new Date(now.getTime() + BARCHART_PREVIEW_EXPIRES_HOURS * 60 * 60 * 1000)

    const candidate: MarketSignalIngestionCandidate = {
      cPrice: parsed.cPrice,
      demandIndex: 1.0,
      source: "API_FEED",
      note: `Barchart preview · ${parsed.symbol}${parsed.contractMonth ? " · " + parsed.contractMonth : ""}`,
      validFrom,
      expiresAt,
      provenance: {
        provider: "barchart-preview",
        sourceName: `Barchart OnDemand getQuote ${parsed.symbol}`,
        sourceUrl: sanitizedUrl,
        retrievedAt: now,
        rawValue: parsed.rawPrice,
        rawUnit: parsed.rawUnit,
        confidence: "HIGH",
      },
    }

    return {
      ok: true,
      providerId: "barchart-preview",
      providerKind: "EXTERNAL_HTTP",
      fetchedAt,
      candidate,
      raw: { sourceUrl: sanitizedUrl, symbol, status: fetched.status, payload },
      diagnostics: [
        ...parsed.diagnostics,
        diag(
          "MSP_DEMAND_INDEX_DEFAULTED",
          "warning",
          "Provider does not supply demandIndex — defaulted to 1.0.",
        ),
        diag(
          "MSP_PROVIDER_CANDIDATE_CREATED",
          "info",
          "Provider produced a MarketSignalIngestionCandidate from the live Barchart quote; no DB writes.",
        ),
        diag(
          "MSP_PROVIDER_PREVIEW_ONLY",
          "info",
          "Preview only — operator must explicitly apply via the manual ingestion form.",
        ),
      ],
    }
  },
}

// ------------------------------------------------------
// BARCHART SETTLEMENT — barchart-settlement-preview
//
// Same Barchart endpoint as barchart-preview, different
// price priority (settlement → settle → close →
// previousClose → lastPrice/last with warning) and a
// settled / final detection step that drives confidence.
//
//   • confidence = HIGH  iff settlementStatus === true AND
//                            priceFieldUsed ∈ { settlement,
//                                              settle,
//                                              close,
//                                              previousClose }
//   • confidence = MEDIUM otherwise (status null/false OR
//                                    lastPrice / last fallback)
//
// Preview-only — never writes MarketSignalSnapshot.
// ------------------------------------------------------

const SETTLEMENT_HIGH_CONFIDENCE_FIELDS = new Set<BarchartSettlementPriceField>([
  "settlement",
  "settle",
  "close",
  "previousClose",
])

export const barchartSettlementPreviewProvider: MarketSignalProvider = {
  id: "barchart-settlement-preview",
  label: "Barchart settlement / EOD preview",
  kind: "EXTERNAL_HTTP",
  description:
    `Fetches a Barchart quote and prefers settlement / close-style prices for contract-safe EOD market signal preview. Settlement preview prefers close / settlement values and is intended for contract-safe CP review. Set ${BARCHART_ENV_VAR} to enable. Preview-only — never writes MarketSignalSnapshot or refreshes B2B prices.`,
  requiresApiKey: true,
  isConfigured: () => readBarchartApiKey() != null,
  async fetchLatest(
    options: MarketSignalProviderFetchOptions = {},
  ): Promise<MarketSignalProviderResult> {

    const fetchedAt = nowIso(options.now)
    const now = options.now ?? new Date()
    const apiKey = readBarchartApiKey(options.apiKey)

    if (!apiKey) {
      return {
        ok: false,
        providerId: "barchart-settlement-preview",
        providerKind: "EXTERNAL_HTTP",
        fetchedAt,
        raw: null,
        diagnostics: [
          diag(
            "MSP_PROVIDER_NOT_CONFIGURED",
            "error",
            `${BARCHART_ENV_VAR} is not set. Configure it server-side to enable the live settlement fetch path.`,
          ),
          diag(
            "MSP_PROVIDER_PREVIEW_ONLY",
            "info",
            "Provider will never write MarketSignalSnapshot — apply still happens through the manual ingestion form.",
          ),
        ],
      }
    }

    const baseUrl = readEnv(BARCHART_BASE_URL_ENV_VAR) ?? BARCHART_DEFAULT_BASE_URL
    const symbol = readEnv(BARCHART_SYMBOL_ENV_VAR) ?? BARCHART_DEFAULT_SYMBOL
    const timeoutMs = options.timeoutMs ?? BARCHART_DEFAULT_TIMEOUT_MS
    const { requestUrl, sanitizedUrl } = buildBarchartUrls(apiKey, symbol, baseUrl)

    const fetchImpl = options.fetchImpl ?? defaultFetchImpl()
    if (!fetchImpl) {
      return {
        ok: false,
        providerId: "barchart-settlement-preview",
        providerKind: "EXTERNAL_HTTP",
        fetchedAt,
        raw: { sourceUrl: sanitizedUrl, symbol },
        diagnostics: [
          diag(
            "MSP_PROVIDER_FETCH_FAILED",
            "error",
            "No fetch implementation is available in the current runtime and no fetchImpl was injected.",
          ),
          diag(
            "MSP_PROVIDER_PREVIEW_ONLY",
            "info",
            "Provider will never write MarketSignalSnapshot.",
          ),
        ],
      }
    }

    // ─── Live fetch ────────────────────────────────
    const fetched = await fetchBarchartPayloadWithTimeout({
      url: requestUrl,
      fetchImpl,
      timeoutMs,
    })

    if (!fetched.ok) {
      return {
        ok: false,
        providerId: "barchart-settlement-preview",
        providerKind: "EXTERNAL_HTTP",
        fetchedAt,
        raw: { sourceUrl: sanitizedUrl, symbol, status: fetched.status },
        diagnostics: [
          diag(
            "MSP_PROVIDER_FETCH_FAILED",
            "error",
            `Barchart settlement fetch failed: ${fetched.reason}.`,
          ),
          diag(
            "MSP_PROVIDER_PREVIEW_ONLY",
            "info",
            "Provider will never write MarketSignalSnapshot.",
          ),
        ],
      }
    }

    let payload: unknown
    try {
      payload = JSON.parse(fetched.body)
    } catch (err) {
      return {
        ok: false,
        providerId: "barchart-settlement-preview",
        providerKind: "EXTERNAL_HTTP",
        fetchedAt,
        raw: { sourceUrl: sanitizedUrl, symbol, status: fetched.status, bodyPreview: fetched.body.slice(0, 200) },
        diagnostics: [
          diag(
            "MSP_PROVIDER_RESPONSE_MALFORMED",
            "error",
            `Barchart settlement response is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
          ),
          diag(
            "MSP_PROVIDER_PREVIEW_ONLY",
            "info",
            "Provider will never write MarketSignalSnapshot.",
          ),
        ],
      }
    }

    // ─── Settlement parser ──────────────────────────
    const parsed = parseBarchartSettlementResponse(payload, now)

    if (!parsed.ok) {
      return {
        ok: false,
        providerId: "barchart-settlement-preview",
        providerKind: "EXTERNAL_HTTP",
        fetchedAt,
        raw: { sourceUrl: sanitizedUrl, symbol, status: fetched.status, payload },
        diagnostics: [
          ...parsed.diagnostics,
          diag(
            "MSP_PROVIDER_PREVIEW_ONLY",
            "info",
            "Provider will never write MarketSignalSnapshot.",
          ),
        ],
      }
    }

    // ─── Confidence: HIGH only when truly settled + non-fallback field ───
    const confidence: "HIGH" | "MEDIUM" =
      parsed.settlementStatus === true &&
      SETTLEMENT_HIGH_CONFIDENCE_FIELDS.has(parsed.priceFieldUsed)
        ? "HIGH"
        : "MEDIUM"

    const validFrom = parsed.timestamp ?? now
    const expiresAt = new Date(now.getTime() + BARCHART_PREVIEW_EXPIRES_HOURS * 60 * 60 * 1000)

    const candidate: MarketSignalIngestionCandidate = {
      cPrice: parsed.cPrice,
      demandIndex: 1.0,
      source: "API_FEED",
      note: `Barchart settlement preview · ${parsed.symbol}${parsed.contractMonth ? " · " + parsed.contractMonth : ""}`,
      validFrom,
      expiresAt,
      provenance: {
        provider: "barchart-settlement-preview",
        sourceName: `Barchart OnDemand settlement/close ${parsed.symbol}`,
        sourceUrl: sanitizedUrl,
        retrievedAt: now,
        rawValue: parsed.rawPrice,
        rawUnit: parsed.rawUnit,
        confidence,
      },
    }

    return {
      ok: true,
      providerId: "barchart-settlement-preview",
      providerKind: "EXTERNAL_HTTP",
      fetchedAt,
      candidate,
      raw: { sourceUrl: sanitizedUrl, symbol, status: fetched.status, payload },
      diagnostics: [
        ...parsed.diagnostics,
        diag(
          "MSP_DEMAND_INDEX_DEFAULTED",
          "warning",
          "Provider does not supply demandIndex — defaulted to 1.0.",
        ),
        diag(
          "MSP_PROVIDER_CANDIDATE_CREATED",
          "info",
          `Provider produced a settlement-style MarketSignalIngestionCandidate (confidence=${confidence}); no DB writes.`,
        ),
        diag(
          "MSP_PROVIDER_PREVIEW_ONLY",
          "info",
          "Preview only — operator must explicitly apply via the manual ingestion form.",
        ),
      ],
    }
  },
}

// ------------------------------------------------------
// REGISTRY
// ------------------------------------------------------

const PROVIDERS: ReadonlyArray<MarketSignalProvider> = [
  mockDelayedIceProvider,
  barchartPreviewProvider,
  barchartSettlementPreviewProvider,
]

const PROVIDERS_BY_ID: Map<string, MarketSignalProvider> = new Map(
  PROVIDERS.map((p) => [p.id, p]),
)

export function getMarketSignalProvider(id: string): MarketSignalProvider | null {
  return PROVIDERS_BY_ID.get(id) ?? null
}

export function listMarketSignalProviders(): MarketSignalProviderSummary[] {
  return PROVIDERS.map((p) => ({
    id: p.id,
    label: p.label,
    kind: p.kind,
    description: p.description,
    requiresApiKey: p.requiresApiKey,
    configured: p.isConfigured(),
  }))
}

export function summarizeProvider(p: MarketSignalProvider): MarketSignalProviderSummary {
  return {
    id: p.id,
    label: p.label,
    kind: p.kind,
    description: p.description,
    requiresApiKey: p.requiresApiKey,
    configured: p.isConfigured(),
  }
}

// ------------------------------------------------------
// PROVIDER ID GUARD
// ------------------------------------------------------

const KNOWN_IDS = new Set<MarketSignalProviderId>([
  "mock-delayed-ice",
  "manual-echo",
  "barchart-preview",
  "barchart-settlement-preview",
])

export function isMarketSignalProviderId(value: unknown): value is MarketSignalProviderId {
  return typeof value === "string" && KNOWN_IDS.has(value as MarketSignalProviderId)
}
