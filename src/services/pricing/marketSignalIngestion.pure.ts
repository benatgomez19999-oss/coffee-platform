//////////////////////////////////////////////////////
// 📡 MARKET SIGNAL INGESTION — PURE VALIDATOR
//
// No Prisma. No DB. No HTTP. Importable under node --test.
// The Prisma service layer (marketSignalIngestion.service.ts)
// imports validateMarketSignalCandidate to decide whether a
// candidate becomes a row. Routes parse user input and call
// the same validator so diagnostics are consistent.
//////////////////////////////////////////////////////

import {
  MSI_CPRICE_MAX,
  MSI_CPRICE_MIN,
  MSI_DEMAND_MAX,
  MSI_DEMAND_MIN,
  MSI_VALID_CONFIDENCES,
  MSI_VALID_SOURCES,
  type MarketSignalConfidence,
  type MarketSignalIngestionCandidate,
  type MarketSignalIngestionDiagnostic,
  type MarketSignalInputSource,
  type MarketSignalProvenanceInput,
  type MarketSignalUnit,
  type MarketSignalValidationResult,
  type NormalizedMarketSignalCandidate,
  type NormalizedMarketSignalProvenance,
} from "./marketSignalIngestion.types.ts"

// ------------------------------------------------------
// LOCAL HELPERS
// ------------------------------------------------------

function parseDate(value: string | Date | null | undefined): {
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

function buildDiag(
  code: string,
  severity: "info" | "warning" | "error",
  message: string
): MarketSignalIngestionDiagnostic {
  return { code, severity, message }
}

function normaliseProvenance(
  input: MarketSignalProvenanceInput | undefined,
  diagnostics: MarketSignalIngestionDiagnostic[]
): { provenance: NormalizedMarketSignalProvenance; warnings: number } {

  let warnings = 0
  if (!input) {
    diagnostics.push(
      buildDiag(
        "MSI_PROVENANCE_MISSING",
        "warning",
        "No provenance metadata supplied — candidate will be persisted without provider / source attribution.",
      ),
    )
    warnings += 1
  }

  const provider = input?.provider?.trim() || null
  const sourceName = input?.sourceName?.trim() || null
  const sourceUrl = input?.sourceUrl?.trim() || null

  const retrievedRaw = parseDate(input?.retrievedAt ?? null)
  if (input?.retrievedAt != null && !retrievedRaw.ok) {
    diagnostics.push(
      buildDiag(
        "MSI_PROVENANCE_PARTIAL",
        "warning",
        "provenance.retrievedAt is not a valid date — dropped.",
      ),
    )
    warnings += 1
  }
  const retrievedAt = retrievedRaw.ok ? retrievedRaw.date : null

  let rawValue: number | null = null
  if (
    input?.rawValue != null &&
    typeof input.rawValue === "number" &&
    Number.isFinite(input.rawValue)
  ) {
    rawValue = input.rawValue
  } else if (input?.rawValue != null) {
    diagnostics.push(
      buildDiag(
        "MSI_PROVENANCE_PARTIAL",
        "warning",
        "provenance.rawValue is not a finite number — dropped.",
      ),
    )
    warnings += 1
  }

  const rawUnit: MarketSignalUnit = "US_CENTS_PER_LB"
  if (input?.rawUnit != null && input.rawUnit !== rawUnit) {
    diagnostics.push(
      buildDiag(
        "MSI_PROVENANCE_PARTIAL",
        "warning",
        `provenance.rawUnit="${input.rawUnit}" is not supported in this sprint — coerced to ${rawUnit}.`,
      ),
    )
    warnings += 1
  }

  let confidence: MarketSignalConfidence = "MEDIUM"
  if (input?.confidence != null) {
    if (MSI_VALID_CONFIDENCES.includes(input.confidence)) {
      confidence = input.confidence
    } else {
      diagnostics.push(
        buildDiag(
          "MSI_PROVENANCE_PARTIAL",
          "warning",
          `provenance.confidence="${input.confidence}" not recognised — defaulted to MEDIUM.`,
        ),
      )
      warnings += 1
    }
  } else if (input) {
    diagnostics.push(
      buildDiag(
        "MSI_PROVENANCE_PARTIAL",
        "warning",
        "provenance.confidence missing — defaulted to MEDIUM.",
      ),
    )
    warnings += 1
  }

  return {
    provenance: {
      provider,
      sourceName,
      sourceUrl,
      retrievedAt,
      rawValue,
      rawUnit,
      confidence,
    },
    warnings,
  }
}

// ------------------------------------------------------
// MAIN VALIDATOR
// ------------------------------------------------------

export function validateMarketSignalCandidate(
  raw: MarketSignalIngestionCandidate,
  options: { now?: Date } = {},
): MarketSignalValidationResult {

  const diagnostics: MarketSignalIngestionDiagnostic[] = []
  const now = options.now ?? new Date()

  // ─── cPrice ────────────────────────────────────────
  if (typeof raw?.cPrice !== "number" || !Number.isFinite(raw.cPrice)) {
    diagnostics.push(
      buildDiag(
        "MSI_INVALID_CPRICE",
        "error",
        "cPrice must be a finite number (US cents/lb).",
      ),
    )
  } else if (raw.cPrice < MSI_CPRICE_MIN || raw.cPrice > MSI_CPRICE_MAX) {
    diagnostics.push(
      buildDiag(
        "MSI_CPRICE_OUT_OF_RANGE",
        "error",
        `cPrice ${raw.cPrice} is outside the in-band range [${MSI_CPRICE_MIN}, ${MSI_CPRICE_MAX}] cents/lb. Sprint policy: no silent clamp — reject.`,
      ),
    )
  }

  // ─── demandIndex ──────────────────────────────────
  if (typeof raw?.demandIndex !== "number" || !Number.isFinite(raw.demandIndex)) {
    diagnostics.push(
      buildDiag(
        "MSI_INVALID_DEMAND_INDEX",
        "error",
        "demandIndex must be a finite number.",
      ),
    )
  } else if (raw.demandIndex < MSI_DEMAND_MIN || raw.demandIndex > MSI_DEMAND_MAX) {
    diagnostics.push(
      buildDiag(
        "MSI_DEMAND_INDEX_OUT_OF_RANGE",
        "error",
        `demandIndex ${raw.demandIndex} is outside [${MSI_DEMAND_MIN}, ${MSI_DEMAND_MAX}].`,
      ),
    )
  }

  // ─── source ───────────────────────────────────────
  if (
    typeof raw?.source !== "string" ||
    !MSI_VALID_SOURCES.includes(raw.source as MarketSignalInputSource)
  ) {
    diagnostics.push(
      buildDiag(
        "MSI_INVALID_SOURCE",
        "error",
        `source must be one of: ${MSI_VALID_SOURCES.join(", ")}.`,
      ),
    )
  }

  // ─── validFrom ────────────────────────────────────
  let validFrom: Date = now
  if (raw?.validFrom != null) {
    const parsed = parseDate(raw.validFrom)
    if (!parsed.ok) {
      diagnostics.push(
        buildDiag(
          "MSI_INVALID_VALID_FROM",
          "error",
          "validFrom must be a valid date.",
        ),
      )
    } else if (parsed.date) {
      validFrom = parsed.date
    }
  }

  // ─── expiresAt ────────────────────────────────────
  let expiresAt: Date | null = null
  if (raw?.expiresAt != null) {
    const parsed = parseDate(raw.expiresAt)
    if (!parsed.ok) {
      diagnostics.push(
        buildDiag(
          "MSI_INVALID_EXPIRES_AT",
          "error",
          "expiresAt must be a valid date.",
        ),
      )
    } else if (parsed.date) {
      expiresAt = parsed.date
      if (expiresAt <= validFrom) {
        diagnostics.push(
          buildDiag(
            "MSI_EXPIRES_BEFORE_VALID_FROM",
            "error",
            "expiresAt must be strictly after validFrom.",
          ),
        )
      }
      if (expiresAt <= now) {
        diagnostics.push(
          buildDiag(
            "MSI_EXPIRES_IN_PAST",
            "error",
            "expiresAt is already in the past — the snapshot would never be considered active.",
          ),
        )
      }
    }
  } else {
    diagnostics.push(
      buildDiag(
        "MSI_PROVENANCE_PARTIAL",
        "warning",
        "expiresAt missing — snapshot will be active until manually superseded.",
      ),
    )
  }

  // ─── provenance ───────────────────────────────────
  const { provenance } = normaliseProvenance(raw?.provenance, diagnostics)

  // Bail out if any error severity diagnostic is present.
  if (diagnostics.some((d) => d.severity === "error")) {
    return { ok: false, diagnostics }
  }

  diagnostics.push(
    buildDiag(
      "MSI_CANDIDATE_VALID",
      "info",
      "Candidate validated. No silent clamping was applied.",
    ),
  )

  // Build the user-supplied note + provenance composite.
  const userNote =
    typeof raw?.note === "string" && raw.note.trim().length > 0
      ? raw.note.trim()
      : null

  const candidate: NormalizedMarketSignalCandidate = {
    cPrice: raw.cPrice,
    demandIndex: raw.demandIndex,
    source: raw.source as MarketSignalInputSource,
    note: userNote,
    validFrom,
    expiresAt,
    provenance,
    diagnostics,
  }

  return { ok: true, candidate }
}

// ------------------------------------------------------
// PROVENANCE NOTE BUILDER
//
// Produces a deterministic, parseable string that captures
// both the operator's free-form note and the structured
// provenance metadata. Stored in PricingSnapshot's `note`
// column because the schema has no dedicated provenance
// fields — see the PRICING-FEED-1 doc for the rationale.
// ------------------------------------------------------

export function buildMarketSignalProvenanceNote(
  candidate: NormalizedMarketSignalCandidate,
  retrievedAtFallback: Date = new Date(),
): string {

  const parts: string[] = []
  parts.push("PRICING-FEED-1")

  parts.push(`cPrice=${candidate.cPrice}`)
  parts.push(`demandIndex=${candidate.demandIndex}`)

  if (candidate.provenance.provider) {
    parts.push(`provider=${candidate.provenance.provider}`)
  }
  if (candidate.provenance.sourceName) {
    parts.push(`sourceName=${candidate.provenance.sourceName}`)
  }
  if (candidate.provenance.sourceUrl) {
    parts.push(`sourceUrl=${candidate.provenance.sourceUrl}`)
  }
  if (candidate.provenance.rawValue != null) {
    parts.push(`rawValue=${candidate.provenance.rawValue}`)
  }
  parts.push(`rawUnit=${candidate.provenance.rawUnit}`)
  parts.push(`confidence=${candidate.provenance.confidence}`)

  const retrievedAt = candidate.provenance.retrievedAt ?? retrievedAtFallback
  parts.push(`retrievedAt=${retrievedAt.toISOString()}`)

  if (candidate.note) {
    // Quote the user note so '|' / '=' inside it don't break parsing.
    const escaped = candidate.note.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
    parts.push(`userNote="${escaped}"`)
  }

  return parts.join(" | ")
}
