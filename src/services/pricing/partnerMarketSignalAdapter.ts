//////////////////////////////////////////////////////
// 🧭 PARTNER MARKET-SIGNAL ROUTE ADAPTER
//
// Pure mapping helpers that turn the legacy
//   POST /api/partner/market-signal
// body into a MarketSignalIngestionCandidate, plus
// response shape adapters that keep the existing
// route response backwards-compatible while still
// surfacing shared ingestion diagnostics.
//
// No Prisma. No HTTP. Importable under node --test.
//////////////////////////////////////////////////////

import type {
  MarketSignalIngestionCandidate,
  MarketSignalIngestionDiagnostic,
} from "./marketSignalIngestion.types.ts"

// ------------------------------------------------------
// PUBLIC TYPES
// ------------------------------------------------------

export type PartnerMarketSignalBody = {
  cPrice?: unknown
  demandIndex?: unknown
  source?: unknown
  note?: unknown
  validFrom?: unknown
  expiresAt?: unknown
}

export type PartnerBodyParseResult =
  | { ok: true; candidate: MarketSignalIngestionCandidate }
  | { ok: false; diagnostics: MarketSignalIngestionDiagnostic[]; httpStatus: number }

export type PartnerCreatedSnapshotView = {
  id: string
  cPrice: number
  demandIndex: number
  source: string
  isActive: boolean
  note: string | null
  validFrom: string
  expiresAt: string | null
  createdAt: string
}

export type PartnerApplyResultLike = {
  ok: boolean
  applied: boolean
  diagnostics: MarketSignalIngestionDiagnostic[]
  createdSnapshot: PartnerCreatedSnapshotView | null
}

export type PartnerSuccessResponse = PartnerCreatedSnapshotView & {
  diagnostics: MarketSignalIngestionDiagnostic[]
  ingestion: {
    ok: boolean
    applied: boolean
  }
}

export type PartnerErrorResponse = {
  error: string
  diagnostics: MarketSignalIngestionDiagnostic[]
}

// ------------------------------------------------------
// CONSTANTS
// ------------------------------------------------------

const VALID_SOURCES = ["MANUAL", "API_FEED", "INTERNAL_COMPUTE", "AI_SYSTEM"] as const

const PARTNER_PROVENANCE = {
  provider: "partner-route",
  sourceName: "Partner submitted market signal",
  rawUnit: "US_CENTS_PER_LB",
  confidence: "OPERATOR_VERIFIED",
} as const

// ------------------------------------------------------
// HELPERS
// ------------------------------------------------------

function diag(
  code: string,
  severity: "error" | "warning" | "info",
  message: string,
): MarketSignalIngestionDiagnostic {
  return { code, severity, message }
}

function isValidSource(value: unknown): value is (typeof VALID_SOURCES)[number] {
  return typeof value === "string" && (VALID_SOURCES as readonly string[]).includes(value)
}

// Normalise body.{validFrom, expiresAt} so the candidate carries the
// raw user input (string or null), letting the shared validator do
// its own date parsing + diagnostics.
function passDateThrough(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) return value
  return null
}

// ------------------------------------------------------
// 1. BODY → CANDIDATE
// ------------------------------------------------------

export function parsePartnerMarketSignalBody(
  body: PartnerMarketSignalBody | null | undefined,
  now: Date = new Date(),
): PartnerBodyParseResult {

  const safe = body ?? {}

  // Preserve legacy contract: source is required.
  if (!isValidSource(safe.source)) {
    return {
      ok: false,
      httpStatus: 400,
      diagnostics: [
        diag(
          "MSI_INVALID_SOURCE",
          "error",
          `source must be one of: ${VALID_SOURCES.join(", ")}.`,
        ),
      ],
    }
  }

  // cPrice + demandIndex flow through as-is so the shared validator
  // can emit MSI_INVALID_CPRICE / MSI_CPRICE_OUT_OF_RANGE without
  // duplicating the rules at adapter level.
  const cPriceRaw = safe.cPrice as unknown
  const demandRaw = safe.demandIndex as unknown

  const candidate: MarketSignalIngestionCandidate = {
    cPrice: cPriceRaw as number,
    demandIndex: demandRaw as number,
    source: safe.source,
    note: typeof safe.note === "string" && safe.note.length > 0 ? safe.note : null,
    validFrom: passDateThrough(safe.validFrom),
    expiresAt: passDateThrough(safe.expiresAt),
    provenance: {
      provider: PARTNER_PROVENANCE.provider,
      sourceName: PARTNER_PROVENANCE.sourceName,
      sourceUrl: null,
      retrievedAt: now,
      rawValue: typeof cPriceRaw === "number" && Number.isFinite(cPriceRaw) ? cPriceRaw : null,
      rawUnit: PARTNER_PROVENANCE.rawUnit,
      confidence: PARTNER_PROVENANCE.confidence,
    },
  }

  return { ok: true, candidate }
}

// ------------------------------------------------------
// 2. APPLY RESULT → SUCCESS RESPONSE
// ------------------------------------------------------

export function buildPartnerMarketSignalResponse(
  result: PartnerApplyResultLike,
): PartnerSuccessResponse {

  const snap = result.createdSnapshot
  if (!snap) {
    // Defensive — only call when result.ok && result.applied. The
    // route checks that before invoking us; this branch keeps the
    // helper total at the type level.
    throw new Error("buildPartnerMarketSignalResponse called without createdSnapshot")
  }

  return {
    id: snap.id,
    cPrice: snap.cPrice,
    demandIndex: snap.demandIndex,
    source: snap.source,
    isActive: snap.isActive,
    note: snap.note,
    validFrom: snap.validFrom,
    expiresAt: snap.expiresAt,
    createdAt: snap.createdAt,
    diagnostics: result.diagnostics,
    ingestion: {
      ok: result.ok,
      applied: result.applied,
    },
  }
}

// ------------------------------------------------------
// 3. ERROR RESPONSE
// ------------------------------------------------------

export function buildPartnerMarketSignalErrorResponse(input: {
  diagnostics: MarketSignalIngestionDiagnostic[]
}): PartnerErrorResponse {
  const firstError = input.diagnostics.find((d) => d.severity === "error")
  return {
    error: firstError?.message ?? "Invalid market signal candidate.",
    diagnostics: input.diagnostics,
  }
}
