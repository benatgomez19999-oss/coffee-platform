//////////////////////////////////////////////////////
// 📈 MARKET SIGNAL TICK — PURE HELPERS
//
// Validation, builder, sanitisation. No Prisma. No HTTP.
// Importable under node --test.
//
// THREE PRODUCT ACTIONS, THREE FUNCTIONS:
//   • Provider preview        → providerPreview (FEED-2A)
//   • Record tick (this file) → buildMarketSignalTickFromProviderPreview
//                               + validateMarketSignalTickInput
//   • Apply active snapshot   → applyMarketSignalIngestion (FEED-1)
// They never call each other automatically.
//////////////////////////////////////////////////////

import {
  MST_ALLOWED_SOURCE_URL_PARAMS,
  MST_CPRICE_MAX,
  MST_CPRICE_MIN,
  MST_DEMAND_MAX,
  MST_DEMAND_MIN,
  MST_REDACTED_PLACEHOLDER,
  MST_SECRET_KEY_PATTERNS,
  MST_VALID_SOURCES,
  type MarketSignalTickDiagnostic,
  type MarketSignalTickInput,
  type MarketSignalTickValidationResult,
  type NormalizedMarketSignalTick,
} from "./marketSignalTick.types.ts"
import type {
  MarketSignalInputSource,
  NormalizedMarketSignalCandidate,
} from "./marketSignalIngestion.types.ts"
import type {
  MarketSignalProviderPreview,
} from "./marketSignalProviders.types.ts"

// ------------------------------------------------------
// LOCAL HELPERS
// ------------------------------------------------------

function diag(
  code: string,
  severity: "info" | "warning" | "error",
  message: string,
): MarketSignalTickDiagnostic {
  return { code, severity, message }
}

function parseDate(value: Date | string | null | undefined): {
  ok: boolean
  date: Date | null
} {
  if (value == null) return { ok: true, date: null }
  if (value instanceof Date) {
    return Number.isFinite(value.getTime())
      ? { ok: true, date: value }
      : { ok: false, date: null }
  }
  if (typeof value !== "string") return { ok: false, date: null }
  const trimmed = value.trim()
  if (trimmed.length === 0) return { ok: true, date: null }
  const parsed = new Date(trimmed)
  return Number.isFinite(parsed.getTime())
    ? { ok: true, date: parsed }
    : { ok: false, date: null }
}

function toTrimmedOrNull(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

// ------------------------------------------------------
// SOURCE URL SANITISER
//
// Strips any query param that isn't on the allow-list. If
// the URL won't parse, returns null + emits a sanitisation
// diagnostic upstream.
// ------------------------------------------------------

export function sanitizeMarketSignalTickSourceUrl(
  raw: string | null | undefined,
): {
  url: string | null
  changed: boolean
} {
  if (typeof raw !== "string") return { url: null, changed: false }
  const trimmed = raw.trim()
  if (trimmed.length === 0) return { url: null, changed: false }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return { url: null, changed: true }
  }

  const allowed = new Set(MST_ALLOWED_SOURCE_URL_PARAMS.map((s) => s.toLowerCase()))
  let changed = false
  const keysToDrop: string[] = []
  parsed.searchParams.forEach((_value, key) => {
    if (!allowed.has(key.toLowerCase())) {
      keysToDrop.push(key)
      changed = true
    }
  })
  for (const key of keysToDrop) parsed.searchParams.delete(key)

  // Drop any embedded credentials.
  if (parsed.username || parsed.password) {
    parsed.username = ""
    parsed.password = ""
    changed = true
  }

  // Drop fragment — Barchart never returns one but defensive.
  if (parsed.hash) {
    parsed.hash = ""
    changed = true
  }

  return { url: parsed.toString(), changed }
}

// ------------------------------------------------------
// RAW PAYLOAD REDACTOR
//
// Recursively walks objects/arrays. For any object key whose
// (lower-cased) name contains a secret-looking token, replaces
// the value with [REDACTED]. Returns a new tree; does not
// mutate the input.
// ------------------------------------------------------

function isSecretKey(key: string): boolean {
  const lower = key.toLowerCase()
  return MST_SECRET_KEY_PATTERNS.some((p) => lower.includes(p))
}

export function sanitizeMarketSignalTickRawPayload(
  raw: unknown,
): { value: unknown; changed: boolean } {

  let changed = false

  const walk = (node: unknown): unknown => {
    if (node === null || node === undefined) return node
    if (Array.isArray(node)) return node.map(walk)
    if (typeof node === "object") {
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if (isSecretKey(k)) {
          out[k] = MST_REDACTED_PLACEHOLDER
          changed = true
        } else {
          out[k] = walk(v)
        }
      }
      return out
    }
    return node
  }

  return { value: walk(raw), changed }
}

// ------------------------------------------------------
// VALIDATION
// ------------------------------------------------------

export function validateMarketSignalTickInput(
  raw: MarketSignalTickInput | null | undefined,
  options: { now?: Date } = {},
): MarketSignalTickValidationResult {

  const diagnostics: MarketSignalTickDiagnostic[] = []
  const input = raw ?? ({} as MarketSignalTickInput)
  const now = options.now ?? new Date()

  // ─── cPrice ───────────────────────────────────────
  if (typeof input.cPrice !== "number" || !Number.isFinite(input.cPrice)) {
    diagnostics.push(diag("MST_INVALID_CPRICE", "error",
      "cPrice must be a finite number (US cents/lb)."))
  } else if (input.cPrice < MST_CPRICE_MIN || input.cPrice > MST_CPRICE_MAX) {
    diagnostics.push(diag("MST_CPRICE_OUT_OF_RANGE", "error",
      `cPrice ${input.cPrice} outside in-band range [${MST_CPRICE_MIN}, ${MST_CPRICE_MAX}]. No silent clamp.`))
  }

  // ─── demandIndex (nullable) ───────────────────────
  let demandIndex: number | null = null
  if (input.demandIndex == null) {
    demandIndex = null
  } else if (typeof input.demandIndex !== "number" || !Number.isFinite(input.demandIndex)) {
    diagnostics.push(diag("MST_INVALID_DEMAND_INDEX", "error",
      "demandIndex, when provided, must be a finite number."))
  } else if (input.demandIndex < MST_DEMAND_MIN || input.demandIndex > MST_DEMAND_MAX) {
    diagnostics.push(diag("MST_DEMAND_INDEX_OUT_OF_RANGE", "error",
      `demandIndex ${input.demandIndex} outside [${MST_DEMAND_MIN}, ${MST_DEMAND_MAX}].`))
  } else {
    demandIndex = input.demandIndex
  }

  // ─── source ──────────────────────────────────────
  if (
    typeof input.source !== "string" ||
    !MST_VALID_SOURCES.includes(input.source as MarketSignalInputSource)
  ) {
    diagnostics.push(diag("MST_INVALID_SOURCE", "error",
      `source must be one of: ${MST_VALID_SOURCES.join(", ")}.`))
  }

  // ─── providerId / providerKind ───────────────────
  const providerId = toTrimmedOrNull(input.providerId)
  if (!providerId) {
    diagnostics.push(diag("MST_INVALID_SOURCE", "error", "providerId is required."))
  }
  const providerKind = toTrimmedOrNull(input.providerKind)
  if (!providerKind) {
    diagnostics.push(diag("MST_INVALID_SOURCE", "error", "providerKind is required."))
  }

  // ─── capturedAt ──────────────────────────────────
  let capturedAt: Date = now
  if (input.capturedAt != null) {
    const parsed = parseDate(input.capturedAt)
    if (!parsed.ok) {
      diagnostics.push(diag("MST_INVALID_CAPTURED_AT", "error",
        "capturedAt must be a valid date if provided."))
    } else if (parsed.date) {
      capturedAt = parsed.date
    }
  }

  // ─── validFrom ───────────────────────────────────
  let validFrom: Date | null = null
  if (input.validFrom != null) {
    const parsed = parseDate(input.validFrom)
    if (!parsed.ok) {
      diagnostics.push(diag("MST_INVALID_VALID_FROM", "error",
        "validFrom must be a valid date if provided."))
    } else {
      validFrom = parsed.date
    }
  }

  // ─── expiresAt — historical ticks may carry past expiry, accept ──
  let expiresAt: Date | null = null
  if (input.expiresAt != null) {
    const parsed = parseDate(input.expiresAt)
    if (!parsed.ok) {
      diagnostics.push(diag("MST_INVALID_EXPIRES_AT", "error",
        "expiresAt must be a valid date if provided."))
    } else {
      expiresAt = parsed.date
    }
  }

  // Bail on errors before sanitising.
  if (diagnostics.some((d) => d.severity === "error")) {
    return { ok: false, diagnostics }
  }

  // ─── sanitise sourceUrl ──────────────────────────
  const urlOut = sanitizeMarketSignalTickSourceUrl(input.sourceUrl)
  if (urlOut.changed) {
    diagnostics.push(diag("MST_SOURCE_URL_SANITIZED", "warning",
      "sourceUrl was sanitised — query params outside the allow-list and any embedded credentials were stripped."))
  }

  // ─── redact rawPayload + diagnostics ─────────────
  const payloadOut = sanitizeMarketSignalTickRawPayload(input.rawPayload)
  if (payloadOut.changed) {
    diagnostics.push(diag("MST_RAW_PAYLOAD_REDACTED", "warning",
      "rawPayload contained secret-looking keys — values were redacted."))
  }
  const diagnosticsOut = sanitizeMarketSignalTickRawPayload(input.diagnostics)
  if (diagnosticsOut.changed) {
    diagnostics.push(diag("MST_RAW_PAYLOAD_REDACTED", "warning",
      "diagnostics blob contained secret-looking keys — values were redacted."))
  }

  diagnostics.push(diag("MST_TICK_VALID", "info", "Tick validated. No silent clamping was applied."))

  const tick: NormalizedMarketSignalTick = {
    providerId: providerId!,
    providerKind: providerKind!,
    source: input.source as MarketSignalInputSource,

    cPrice: input.cPrice,
    demandIndex,
    confidence: toTrimmedOrNull(input.confidence),
    rawUnit: toTrimmedOrNull(input.rawUnit),
    rawValue:
      typeof input.rawValue === "number" && Number.isFinite(input.rawValue)
        ? input.rawValue
        : null,

    symbol: toTrimmedOrNull(input.symbol),
    contractMonth: toTrimmedOrNull(input.contractMonth),

    capturedAt,
    validFrom,
    expiresAt,

    sourceName: toTrimmedOrNull(input.sourceName),
    sourceUrl: urlOut.url,
    note: toTrimmedOrNull(input.note),

    diagnostics: diagnosticsOut.value,
    rawPayload: payloadOut.value,
  }

  return { ok: true, tick, diagnostics }
}

// ------------------------------------------------------
// BUILDER FROM PROVIDER PREVIEW
// ------------------------------------------------------

export function buildMarketSignalTickFromProviderPreview(
  preview: MarketSignalProviderPreview | null | undefined,
  options: { now?: Date } = {},
): MarketSignalTickValidationResult {

  const now = options.now ?? new Date()

  if (!preview) {
    return {
      ok: false,
      diagnostics: [diag("MST_PROVIDER_PREVIEW_INVALID", "error",
        "Provider preview payload is missing.")],
    }
  }
  if (!preview.canApply || !preview.previewCandidate || !preview.provider) {
    return {
      ok: false,
      diagnostics: [diag("MST_PROVIDER_PREVIEW_NOT_APPLICABLE", "error",
        "Provider preview is not applicable for tick recording (canApply=false or previewCandidate missing).")],
    }
  }

  const candidate: NormalizedMarketSignalCandidate = preview.previewCandidate
  const rawPayload =
    preview.providerResult && preview.providerResult.ok === true
      ? preview.providerResult.raw
      : preview.providerResult?.raw ?? null

  const input: MarketSignalTickInput = {
    providerId: preview.provider.id,
    providerKind: preview.provider.kind,
    source: candidate.source,
    cPrice: candidate.cPrice,
    demandIndex: candidate.demandIndex,
    confidence: candidate.provenance.confidence ?? null,
    rawUnit: candidate.provenance.rawUnit ?? null,
    rawValue: candidate.provenance.rawValue ?? null,
    symbol: extractSymbolFromRaw(rawPayload),
    contractMonth: null,
    capturedAt: now,
    validFrom: candidate.validFrom,
    expiresAt: candidate.expiresAt,
    sourceName: candidate.provenance.sourceName ?? null,
    sourceUrl: candidate.provenance.sourceUrl ?? null,
    note: candidate.note,
    diagnostics: preview.diagnostics,
    rawPayload,
  }

  return validateMarketSignalTickInput(input, { now })
}

function extractSymbolFromRaw(raw: unknown): string | null {
  if (raw === null || typeof raw !== "object") return null
  const obj = raw as Record<string, unknown>
  if (typeof obj.symbol === "string" && obj.symbol.trim().length > 0) {
    return obj.symbol.trim()
  }
  return null
}
