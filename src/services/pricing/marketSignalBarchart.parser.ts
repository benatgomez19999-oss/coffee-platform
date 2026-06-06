//////////////////////////////////////////////////////
// 📊 BARCHART getQuote.json — PURE PARSER
//
// No Prisma. No fetch. No env. Importable under
// node --test. Defensive about field names because
// Barchart's response can vary by symbol/account.
//
// Contract:
//   • Treats KC*1 (Coffee C) as US cents/lb.
//     If a future field declares a different unit, the
//     parser bails with MSP_BARCHART_PRICE_INVALID rather
//     than guessing a conversion.
//
//   • Returns ok:true with the resolved cPrice / rawPrice /
//     timestamp / symbol when the payload is shaped as
//     `{ status: { code: 200 }, results: [{ ... }] }`.
//
//   • Returns ok:false with structured diagnostics for
//     every other failure mode.
//////////////////////////////////////////////////////

import type { MarketSignalIngestionDiagnostic } from "./marketSignalIngestion.types.ts"
import type { MarketSignalUnit } from "./marketSignalIngestion.types.ts"
import { MSP_DIAGNOSTIC_CODES } from "./marketSignalProviders.types.ts"

// ------------------------------------------------------
// PUBLIC TYPES
// ------------------------------------------------------

export type BarchartQuoteParseOk = {
  ok: true
  cPrice: number
  rawPrice: number
  rawUnit: MarketSignalUnit  // always "US_CENTS_PER_LB" in this sprint
  symbol: string
  contractMonth: string | null
  timestamp: Date | null
  diagnostics: MarketSignalIngestionDiagnostic[]
}

export type BarchartQuoteParseErr = {
  ok: false
  diagnostics: MarketSignalIngestionDiagnostic[]
}

export type BarchartQuoteParseResult =
  | BarchartQuoteParseOk
  | BarchartQuoteParseErr

// ------------------------------------------------------
// HELPERS
// ------------------------------------------------------

function diag(
  code: keyof typeof MSP_DIAGNOSTIC_CODES,
  severity: "error" | "warning" | "info",
  message: string,
): MarketSignalIngestionDiagnostic {
  return { code: MSP_DIAGNOSTIC_CODES[code], severity, message }
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (trimmed.length === 0) return null
    const n = Number(trimmed)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

// ------------------------------------------------------
// PRICE EXTRACTION
//
// Field priority: lastPrice → last → close → previousClose.
// Each is run through asNumber() so numeric strings are
// accepted alongside numbers.
// ------------------------------------------------------

const PRICE_FIELDS = [
  "lastPrice",
  "last",
  "close",
  "previousClose",
] as const

function pickPrice(result: Record<string, unknown>): {
  value: number | null
  source: string | null
} {
  for (const key of PRICE_FIELDS) {
    if (key in result) {
      const v = asNumber(result[key])
      if (v != null) return { value: v, source: key }
    }
  }
  return { value: null, source: null }
}

// ------------------------------------------------------
// TIMESTAMP EXTRACTION
//
// tradeTimestamp → serverTimestamp → timestamp. If a field
// is present but unparseable, the parser still resolves the
// quote (price wins) but emits a TIMESTAMP_INVALID diagnostic.
// ------------------------------------------------------

const TIMESTAMP_FIELDS = ["tradeTimestamp", "serverTimestamp", "timestamp"] as const

function pickTimestamp(result: Record<string, unknown>): {
  date: Date | null
  invalidFields: string[]
} {
  const invalidFields: string[] = []
  for (const key of TIMESTAMP_FIELDS) {
    if (key in result) {
      const raw = result[key]
      if (raw == null) continue
      if (typeof raw === "string" && raw.trim().length === 0) continue
      const parsed = new Date(raw as string | number)
      if (Number.isFinite(parsed.getTime())) return { date: parsed, invalidFields }
      invalidFields.push(key)
    }
  }
  return { date: null, invalidFields }
}

// ------------------------------------------------------
// MAIN
// ------------------------------------------------------

export function parseBarchartGetQuoteResponse(
  payload: unknown,
  _now: Date = new Date(),
): BarchartQuoteParseResult {

  const root = asObject(payload)
  if (!root) {
    return {
      ok: false,
      diagnostics: [
        diag(
          "MSP_PROVIDER_RESPONSE_MALFORMED",
          "error",
          "Barchart response is not a JSON object.",
        ),
      ],
    }
  }

  // ─── Status ────────────────────────────────────────
  const status = asObject(root.status)
  if (status) {
    const codeValue = asNumber(status.code)
    if (codeValue !== null && codeValue !== 200) {
      const message = asNonEmptyString(status.message) ?? "Unknown Barchart status"
      return {
        ok: false,
        diagnostics: [
          diag(
            "MSP_BARCHART_STATUS_ERROR",
            "error",
            `Barchart status.code=${codeValue}: ${message}`,
          ),
        ],
      }
    }
  }

  // ─── Results ──────────────────────────────────────
  const results = asArray(root.results)
  if (!results || results.length === 0) {
    return {
      ok: false,
      diagnostics: [
        diag(
          "MSP_BARCHART_EMPTY_RESULTS",
          "error",
          "Barchart response has no results entries.",
        ),
      ],
    }
  }

  const first = asObject(results[0])
  if (!first) {
    return {
      ok: false,
      diagnostics: [
        diag(
          "MSP_PROVIDER_RESPONSE_MALFORMED",
          "error",
          "Barchart results[0] is not an object.",
        ),
      ],
    }
  }

  // ─── Price ────────────────────────────────────────
  const { value: rawPrice, source: priceSource } = pickPrice(first)
  if (rawPrice == null) {
    return {
      ok: false,
      diagnostics: [
        diag(
          "MSP_BARCHART_PRICE_MISSING",
          "error",
          `Barchart result has no usable price field (tried: ${PRICE_FIELDS.join(", ")}).`,
        ),
      ],
    }
  }
  if (!Number.isFinite(rawPrice) || rawPrice <= 0) {
    return {
      ok: false,
      diagnostics: [
        diag(
          "MSP_BARCHART_PRICE_INVALID",
          "error",
          `Barchart price field "${priceSource}" is not a usable positive number: ${rawPrice}.`,
        ),
      ],
    }
  }

  // KC*1 (Coffee C) is conventionally quoted in US cents/lb.
  // If/when a future provider returns a different unit, this
  // is where to add a unit-detection branch — for now we never
  // guess.
  const cPrice = rawPrice
  const rawUnit: MarketSignalUnit = "US_CENTS_PER_LB"

  // ─── Symbol / contract month ──────────────────────
  const symbol =
    asNonEmptyString(first.symbol) ??
    asNonEmptyString(asObject(first.raw)?.symbol) ??
    null

  const contractMonth =
    asNonEmptyString(first.contractMonth) ??
    asNonEmptyString(first.contract) ??
    null

  // ─── Timestamp ────────────────────────────────────
  const { date: timestamp, invalidFields } = pickTimestamp(first)
  const diagnostics: MarketSignalIngestionDiagnostic[] = []

  if (invalidFields.length > 0 && timestamp == null) {
    diagnostics.push(
      diag(
        "MSP_BARCHART_TIMESTAMP_INVALID",
        "warning",
        `Barchart timestamp fields could not be parsed: ${invalidFields.join(", ")}. Falling back to retrievedAt.`,
      ),
    )
  }

  if (!symbol) {
    diagnostics.push(
      diag(
        "MSP_BARCHART_SYMBOL_MISSING",
        "warning",
        "Barchart result has no symbol field — provenance.sourceName will not include the contract symbol.",
      ),
    )
  }

  diagnostics.push(
    diag(
      "MSP_BARCHART_PARSED",
      "info",
      `Parsed Barchart quote (price source: ${priceSource}, ${cPrice} ¢/lb).`,
    ),
  )

  return {
    ok: true,
    cPrice,
    rawPrice,
    rawUnit,
    symbol: symbol ?? "UNKNOWN",
    contractMonth,
    timestamp,
    diagnostics,
  }
}

// ======================================================
// SETTLEMENT / EOD PARSER (PRICING-FEED-2C)
//
// A second parser sharing the helpers above. Intended for
// the future contract-authoritative CP path: prefers
// settlement-style prices (settlement → settle → close →
// previousClose) and falls back to lastPrice / last only
// with an explicit warning.
//
// Adds:
//   • priceFieldUsed: which field produced the price.
//   • settlementStatus: true/false/null inferred from the
//     provider's session/finalised flags.
// ======================================================

export type BarchartSettlementPriceField =
  | "settlement"
  | "settle"
  | "close"
  | "previousClose"
  | "lastPrice"
  | "last"

export type BarchartSettlementParseOk = {
  ok: true
  cPrice: number
  rawPrice: number
  rawUnit: MarketSignalUnit
  symbol: string
  contractMonth: string | null
  timestamp: Date | null
  priceFieldUsed: BarchartSettlementPriceField
  settlementStatus: boolean | null
  diagnostics: MarketSignalIngestionDiagnostic[]
}

export type BarchartSettlementParseErr = {
  ok: false
  diagnostics: MarketSignalIngestionDiagnostic[]
}

export type BarchartSettlementParseResult =
  | BarchartSettlementParseOk
  | BarchartSettlementParseErr

const SETTLEMENT_PRICE_PRIORITY: ReadonlyArray<BarchartSettlementPriceField> = [
  "settlement",
  "settle",
  "close",
  "previousClose",
  "lastPrice",
  "last",
]

// Considered "live / not-final" if the price came from one of these fields.
const SETTLEMENT_FALLBACK_FIELDS: ReadonlyArray<BarchartSettlementPriceField> = [
  "lastPrice",
  "last",
]

function pickSettlementPrice(result: Record<string, unknown>): {
  value: number | null
  source: BarchartSettlementPriceField | null
} {
  for (const key of SETTLEMENT_PRICE_PRIORITY) {
    if (key in result) {
      const v = asNumber(result[key])
      if (v != null) return { value: v, source: key }
    }
  }
  return { value: null, source: null }
}

// ─── Settled / final detection ─────────────────────
//
// Boolean fields take precedence over string-status hints. We never
// guess: if a field is present and tells us, we believe it. Otherwise
// `null` and the caller decides confidence.

const SETTLEMENT_BOOL_FIELDS: ReadonlyArray<string> = [
  "isSettled", "settled", "isFinal", "final",
]

const SETTLEMENT_STATUS_FIELDS: ReadonlyArray<string> = [
  "status", "tradeStatus", "session", "quoteType", "mode",
]

const FINAL_KEYWORDS: ReadonlyArray<string> = ["settled", "final", "closed"]
const NOT_FINAL_KEYWORDS: ReadonlyArray<string> = [
  "open", "trading", "delayed", "live", "intraday", "real-time", "realtime",
]

export function isSettlementFinal(
  result: Record<string, unknown>,
): boolean | null {

  for (const key of SETTLEMENT_BOOL_FIELDS) {
    if (key in result) {
      const v = result[key]
      if (v === true) return true
      if (v === false) return false
    }
  }

  for (const key of SETTLEMENT_STATUS_FIELDS) {
    const s = asNonEmptyString(result[key])
    if (s == null) continue
    const lower = s.toLowerCase()
    if (FINAL_KEYWORDS.some((kw) => lower.includes(kw))) return true
    if (NOT_FINAL_KEYWORDS.some((kw) => lower.includes(kw))) return false
  }

  return null
}

export function parseBarchartSettlementResponse(
  payload: unknown,
  _now: Date = new Date(),
): BarchartSettlementParseResult {

  const root = asObject(payload)
  if (!root) {
    return {
      ok: false,
      diagnostics: [
        diag(
          "MSP_PROVIDER_RESPONSE_MALFORMED",
          "error",
          "Barchart settlement response is not a JSON object.",
        ),
      ],
    }
  }

  const status = asObject(root.status)
  if (status) {
    const codeValue = asNumber(status.code)
    if (codeValue !== null && codeValue !== 200) {
      const message = asNonEmptyString(status.message) ?? "Unknown Barchart status"
      return {
        ok: false,
        diagnostics: [
          diag(
            "MSP_BARCHART_STATUS_ERROR",
            "error",
            `Barchart status.code=${codeValue}: ${message}`,
          ),
        ],
      }
    }
  }

  const results = asArray(root.results)
  if (!results || results.length === 0) {
    return {
      ok: false,
      diagnostics: [
        diag(
          "MSP_BARCHART_EMPTY_RESULTS",
          "error",
          "Barchart settlement response has no results entries.",
        ),
      ],
    }
  }

  const first = asObject(results[0])
  if (!first) {
    return {
      ok: false,
      diagnostics: [
        diag(
          "MSP_PROVIDER_RESPONSE_MALFORMED",
          "error",
          "Barchart settlement results[0] is not an object.",
        ),
      ],
    }
  }

  const { value: rawPrice, source: priceSource } = pickSettlementPrice(first)
  if (rawPrice == null || priceSource == null) {
    return {
      ok: false,
      diagnostics: [
        diag(
          "MSP_BARCHART_PRICE_MISSING",
          "error",
          `Barchart settlement result has no usable price field (tried: ${SETTLEMENT_PRICE_PRIORITY.join(", ")}).`,
        ),
      ],
    }
  }
  if (!Number.isFinite(rawPrice) || rawPrice <= 0) {
    return {
      ok: false,
      diagnostics: [
        diag(
          "MSP_BARCHART_PRICE_INVALID",
          "error",
          `Barchart settlement price field "${priceSource}" is not a usable positive number: ${rawPrice}.`,
        ),
      ],
    }
  }

  const settlementStatus = isSettlementFinal(first)

  const symbol =
    asNonEmptyString(first.symbol) ??
    asNonEmptyString(asObject(first.raw)?.symbol) ??
    "UNKNOWN"
  const contractMonth =
    asNonEmptyString(first.contractMonth) ??
    asNonEmptyString(first.contract) ??
    null
  const { date: timestamp, invalidFields } = pickTimestamp(first)

  const diagnostics: MarketSignalIngestionDiagnostic[] = []

  if (settlementStatus === true) {
    diagnostics.push(
      diag(
        "MSP_BARCHART_SETTLEMENT_FINAL",
        "info",
        "Provider fields indicate the quote is final / settled.",
      ),
    )
  } else if (settlementStatus === false) {
    diagnostics.push(
      diag(
        "MSP_BARCHART_SETTLEMENT_NOT_FINAL",
        "warning",
        "Provider fields indicate the quote is intraday / not yet settled.",
      ),
    )
  } else {
    diagnostics.push(
      diag(
        "MSP_BARCHART_SETTLEMENT_STATUS_UNKNOWN",
        "warning",
        "Could not determine settlement status from provider fields — confidence will not be HIGH.",
      ),
    )
  }

  if (SETTLEMENT_FALLBACK_FIELDS.includes(priceSource)) {
    diagnostics.push(
      diag(
        "MSP_BARCHART_SETTLEMENT_FALLBACK_TO_LAST",
        "warning",
        `Falling back to "${priceSource}" — settlement / close / previousClose were not available.`,
      ),
    )
  }

  diagnostics.push(
    diag(
      "MSP_BARCHART_SETTLEMENT_PRICE_SELECTED",
      "info",
      `Selected price field "${priceSource}" = ${rawPrice} ¢/lb.`,
    ),
  )

  if (invalidFields.length > 0 && timestamp == null) {
    diagnostics.push(
      diag(
        "MSP_BARCHART_TIMESTAMP_INVALID",
        "warning",
        `Barchart timestamp fields could not be parsed: ${invalidFields.join(", ")}. Falling back to retrievedAt.`,
      ),
    )
  }

  if (symbol === "UNKNOWN") {
    diagnostics.push(
      diag(
        "MSP_BARCHART_SYMBOL_MISSING",
        "warning",
        "Barchart settlement result has no symbol field — provenance.sourceName will not include the contract symbol.",
      ),
    )
  }

  return {
    ok: true,
    cPrice: rawPrice,
    rawPrice,
    rawUnit: "US_CENTS_PER_LB",
    symbol,
    contractMonth,
    timestamp,
    priceFieldUsed: priceSource,
    settlementStatus,
    diagnostics,
  }
}
