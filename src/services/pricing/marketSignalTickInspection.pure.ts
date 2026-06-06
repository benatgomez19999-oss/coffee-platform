//////////////////////////////////////////////////////
// 🔍 MARKET SIGNAL TICK — INSPECTION FORMATTERS
//
// Pure helpers for the read-only tick inspector
// (PRICING-FEED-3C). No Prisma, no fetch, no env.
// Importable under node --test.
//
// Read-time defence: FEED-3A already sanitises on write,
// but we re-run the sanitisers here as belt-and-braces.
// If a legacy row (or some external write path we don't
// own) ever stored a secret, the inspector still scrubs
// it before display.
//////////////////////////////////////////////////////

import {
  sanitizeMarketSignalTickRawPayload,
  sanitizeMarketSignalTickSourceUrl,
} from "./marketSignalTick.pure.ts"
import { MST_SECRET_KEY_PATTERNS } from "./marketSignalTick.types.ts"

// ------------------------------------------------------
// PUBLIC TYPES
// ------------------------------------------------------

/**
 * Structural row type — accepts the raw Prisma `MarketSignalTick`
 * row or any other shape with the same property names. Date fields
 * may be either `Date` or already-stringified.
 */
export type MarketSignalTickInspectionRow = {
  id: string
  providerId: string
  providerKind: string
  source: string
  cPrice: number
  demandIndex: number | null
  confidence: string | null
  rawUnit: string | null
  rawValue: number | null
  symbol: string | null
  contractMonth: string | null
  capturedAt: Date | string
  validFrom: Date | string | null
  expiresAt: Date | string | null
  sourceName: string | null
  sourceUrl: string | null
  note: string | null
  diagnostics: unknown
  rawPayload: unknown
  createdAt: Date | string
}

export type MarketSignalTickInspectionTick = {
  id: string
  providerId: string
  providerKind: string
  source: string

  cPrice: number
  demandIndex: number | null
  confidence: string | null
  rawUnit: string | null
  rawValue: number | null

  symbol: string | null
  contractMonth: string | null

  capturedAt: string
  validFrom: string | null
  expiresAt: string | null
  createdAt: string

  sourceName: string | null
  sourceUrl: string | null
  note: string | null

  diagnostics: unknown
  rawPayload: unknown
}

export type MarketSignalTickInspectionSafety = {
  rawPayloadSanitised: boolean
  sourceUrlSanitised: boolean
  containsKnownSecretKeys: boolean
}

export type MarketSignalTickInspectionErrorCode =
  | "MST_TICK_NOT_FOUND"
  | "MST_TICK_INVALID_ID"

export type MarketSignalTickInspectionResult =
  | {
      ok: true
      generatedAt: string
      tick: MarketSignalTickInspectionTick
      safety: MarketSignalTickInspectionSafety
    }
  | {
      ok: false
      generatedAt: string
      error: {
        code: MarketSignalTickInspectionErrorCode
        message: string
      }
    }

// ------------------------------------------------------
// ID VALIDATION
// ------------------------------------------------------

export function validateMarketSignalTickInspectionId(raw: unknown): {
  ok: boolean
  id: string | null
  reason: string | null
} {
  if (typeof raw !== "string") {
    return { ok: false, id: null, reason: "id must be a string." }
  }
  const trimmed = raw.trim()
  if (trimmed.length === 0) {
    return { ok: false, id: null, reason: "id must not be empty." }
  }
  return { ok: true, id: trimmed, reason: null }
}

// ------------------------------------------------------
// SECRET-KEY DETECTOR
//
// Walks `payload` looking for any object key whose name
// matches one of the secret-looking tokens. Pure read —
// does not mutate or redact.
// ------------------------------------------------------

function isSecretKey(key: string): boolean {
  const lower = key.toLowerCase()
  return MST_SECRET_KEY_PATTERNS.some((p) => lower.includes(p))
}

export function detectKnownSecretKeys(payload: unknown): boolean {
  if (payload === null || payload === undefined) return false
  if (Array.isArray(payload)) {
    for (const item of payload) {
      if (detectKnownSecretKeys(item)) return true
    }
    return false
  }
  if (typeof payload === "object") {
    for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
      if (isSecretKey(k)) return true
      if (detectKnownSecretKeys(v)) return true
    }
    return false
  }
  return false
}

// ------------------------------------------------------
// ROW SERIALISER (dates → ISO)
// ------------------------------------------------------

function toIso(value: Date | string): string {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.toISOString() : ""
  }
  if (typeof value === "string") {
    const t = Date.parse(value)
    return Number.isFinite(t) ? new Date(t).toISOString() : value
  }
  return ""
}

function toIsoOrNull(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const iso = toIso(value)
  return iso.length > 0 ? iso : null
}

/**
 * Serialises a single row to the JSON-friendly shape the inspector
 * payload exposes. Does NOT sanitise — see
 * `buildMarketSignalTickInspectionFromRow` for the full pipeline.
 */
export function serialiseMarketSignalTickInspection(
  row: MarketSignalTickInspectionRow,
): MarketSignalTickInspectionTick {
  return {
    id: row.id,
    providerId: row.providerId,
    providerKind: row.providerKind,
    source: row.source,

    cPrice: row.cPrice,
    demandIndex: row.demandIndex,
    confidence: row.confidence,
    rawUnit: row.rawUnit,
    rawValue: row.rawValue,

    symbol: row.symbol,
    contractMonth: row.contractMonth,

    capturedAt: toIso(row.capturedAt),
    validFrom: toIsoOrNull(row.validFrom),
    expiresAt: toIsoOrNull(row.expiresAt),
    createdAt: toIso(row.createdAt),

    sourceName: row.sourceName,
    sourceUrl: row.sourceUrl,
    note: row.note,

    diagnostics: row.diagnostics,
    rawPayload: row.rawPayload,
  }
}

// ------------------------------------------------------
// MAIN BUILDER
//
// Returns the inspector result. Read-only — never mutates
// `row`. Sanitises `rawPayload` + `sourceUrl` on read so
// the response is safe even when an older row was written
// before the FEED-3A on-write sanitisers existed.
// ------------------------------------------------------

export function buildMarketSignalTickInspectionFromRow(
  row: MarketSignalTickInspectionRow | null | undefined,
  options: { now?: Date } = {},
): MarketSignalTickInspectionResult {

  const generatedAt = (options.now ?? new Date()).toISOString()

  if (!row) {
    return {
      ok: false,
      generatedAt,
      error: {
        code: "MST_TICK_NOT_FOUND",
        message: "No MarketSignalTick row matches the requested id.",
      },
    }
  }

  // Detect on the *original* payload so we report what the DB row
  // looked like before scrubbing.
  const containsKnownSecretKeys = detectKnownSecretKeys(row.rawPayload)

  // Run sanitisers again as belt-and-braces.
  const payloadOut = sanitizeMarketSignalTickRawPayload(row.rawPayload)
  const urlOut = sanitizeMarketSignalTickSourceUrl(row.sourceUrl)

  // Diagnostics blob may itself contain secret-looking keys (e.g. if
  // a provider preview embedded one). Scrub on read.
  const diagnosticsOut = sanitizeMarketSignalTickRawPayload(row.diagnostics)

  const tick: MarketSignalTickInspectionTick = {
    ...serialiseMarketSignalTickInspection(row),
    sourceUrl: urlOut.url,
    rawPayload: payloadOut.value,
    diagnostics: diagnosticsOut.value,
  }

  const safety: MarketSignalTickInspectionSafety = {
    rawPayloadSanitised: payloadOut.changed || diagnosticsOut.changed,
    sourceUrlSanitised: urlOut.changed,
    containsKnownSecretKeys,
  }

  return {
    ok: true,
    generatedAt,
    tick,
    safety,
  }
}
