//////////////////////////////////////////////////////
// 🧪 PARTNER MARKET-SIGNAL ROUTE ADAPTER — PURE TESTS
//
// No Prisma. No HTTP. Verifies that:
//   • body → candidate mapping carries the partner-route
//     provenance signature
//   • the shared FEED-1 validator catches the same range
//     violations the legacy route used to enforce inline
//   • the success/error response shapes preserve legacy
//     top-level snapshot fields while adding diagnostics
//////////////////////////////////////////////////////

import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  buildPartnerMarketSignalErrorResponse,
  buildPartnerMarketSignalResponse,
  parsePartnerMarketSignalBody,
  type PartnerApplyResultLike,
} from "../partnerMarketSignalAdapter.ts"
import { validateMarketSignalCandidate } from "../marketSignalIngestion.pure.ts"

const FIXED_NOW = new Date("2026-05-09T12:00:00.000Z")
const FUTURE_DATE = new Date("2026-05-15T12:00:00.000Z")
const PAST_DATE = new Date("2026-05-01T12:00:00.000Z")

// ------------------------------------------------------
// 1. BODY → CANDIDATE
// ------------------------------------------------------

describe("parsePartnerMarketSignalBody — mapping", () => {

  it("maps a valid partner body into a MarketSignalIngestionCandidate", () => {
    const result = parsePartnerMarketSignalBody({
      cPrice: 290,
      demandIndex: 1.10,
      source: "MANUAL",
      note: "Partner consolidation test",
      expiresAt: FUTURE_DATE.toISOString(),
    }, FIXED_NOW)

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.candidate.cPrice, 290)
    assert.equal(result.candidate.demandIndex, 1.10)
    assert.equal(result.candidate.source, "MANUAL")
    assert.equal(result.candidate.note, "Partner consolidation test")
    assert.equal(result.candidate.expiresAt, FUTURE_DATE.toISOString())
  })

  it("stamps provenance.provider = 'partner-route'", () => {
    const result = parsePartnerMarketSignalBody({
      cPrice: 290, demandIndex: 1.10, source: "MANUAL",
    }, FIXED_NOW)
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.candidate.provenance?.provider, "partner-route")
    assert.equal(result.candidate.provenance?.sourceName, "Partner submitted market signal")
    assert.equal(result.candidate.provenance?.confidence, "OPERATOR_VERIFIED")
    assert.equal(result.candidate.provenance?.rawUnit, "US_CENTS_PER_LB")
    assert.equal(result.candidate.provenance?.rawValue, 290)
    assert.equal(result.candidate.provenance?.retrievedAt, FIXED_NOW)
  })

  it("preserves legacy note as the ingestion candidate's user note", () => {
    const result = parsePartnerMarketSignalBody({
      cPrice: 290, demandIndex: 1.10, source: "MANUAL",
      note: "ICE July settlement",
    }, FIXED_NOW)
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.candidate.note, "ICE July settlement")
  })

  it("rejects missing source with 400 + MSI_INVALID_SOURCE", () => {
    const result = parsePartnerMarketSignalBody({
      cPrice: 290, demandIndex: 1.10,
    }, FIXED_NOW)
    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.httpStatus, 400)
    assert.ok(result.diagnostics.some((d) => d.code === "MSI_INVALID_SOURCE"))
  })

  it("rejects an unknown source string with 400 + MSI_INVALID_SOURCE", () => {
    const result = parsePartnerMarketSignalBody({
      cPrice: 290, demandIndex: 1.10, source: "MAGIC",
    }, FIXED_NOW)
    assert.equal(result.ok, false)
    if (result.ok) return
    assert.ok(result.diagnostics.some((d) => d.code === "MSI_INVALID_SOURCE"))
  })

  it("rawValue is null when cPrice is not a finite number (validator will catch)", () => {
    const result = parsePartnerMarketSignalBody({
      cPrice: "not a number" as unknown as number,
      demandIndex: 1.10,
      source: "MANUAL",
    }, FIXED_NOW)
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.candidate.provenance?.rawValue, null)
  })
})

// ------------------------------------------------------
// 2. END-TO-END THROUGH THE SHARED VALIDATOR
//
// These prove the partner route now relies on the same
// rules as the dev route (PRICING-FEED-1).
// ------------------------------------------------------

describe("partner adapter → shared validator", () => {

  it("invalid cPrice (49) is rejected by the shared validator with MSI_CPRICE_OUT_OF_RANGE", () => {
    const parsed = parsePartnerMarketSignalBody({
      cPrice: 49, demandIndex: 1.10, source: "MANUAL",
    }, FIXED_NOW)
    assert.equal(parsed.ok, true)
    if (!parsed.ok) return
    const validation = validateMarketSignalCandidate(parsed.candidate, { now: FIXED_NOW })
    assert.equal(validation.ok, false)
    if (validation.ok) return
    assert.ok(validation.diagnostics.some((d) => d.code === "MSI_CPRICE_OUT_OF_RANGE"))
  })

  it("does NOT silently clamp cPrice 49 → 50", () => {
    const parsed = parsePartnerMarketSignalBody({
      cPrice: 49, demandIndex: 1.10, source: "MANUAL",
    }, FIXED_NOW)
    assert.equal(parsed.ok, true)
    if (!parsed.ok) return
    // Adapter does not clamp.
    assert.equal(parsed.candidate.cPrice, 49)
    // Validator rejects it — no clamp.
    const validation = validateMarketSignalCandidate(parsed.candidate, { now: FIXED_NOW })
    assert.equal(validation.ok, false)
  })

  it("invalid demandIndex (1.5) is rejected with MSI_DEMAND_INDEX_OUT_OF_RANGE", () => {
    const parsed = parsePartnerMarketSignalBody({
      cPrice: 290, demandIndex: 1.5, source: "MANUAL",
    }, FIXED_NOW)
    assert.equal(parsed.ok, true)
    if (!parsed.ok) return
    const validation = validateMarketSignalCandidate(parsed.candidate, { now: FIXED_NOW })
    assert.equal(validation.ok, false)
    if (validation.ok) return
    assert.ok(validation.diagnostics.some((d) => d.code === "MSI_DEMAND_INDEX_OUT_OF_RANGE"))
  })

  it("expiresAt in the past is rejected with MSI_EXPIRES_IN_PAST", () => {
    const parsed = parsePartnerMarketSignalBody({
      cPrice: 290, demandIndex: 1.10, source: "MANUAL",
      expiresAt: PAST_DATE.toISOString(),
    }, FIXED_NOW)
    assert.equal(parsed.ok, true)
    if (!parsed.ok) return
    const validation = validateMarketSignalCandidate(parsed.candidate, { now: FIXED_NOW })
    assert.equal(validation.ok, false)
    if (validation.ok) return
    assert.ok(validation.diagnostics.some((d) => d.code === "MSI_EXPIRES_IN_PAST"))
  })

  it("a valid partner candidate produces OPERATOR_VERIFIED provenance after validation", () => {
    const parsed = parsePartnerMarketSignalBody({
      cPrice: 290, demandIndex: 1.10, source: "MANUAL",
      expiresAt: FUTURE_DATE.toISOString(),
    }, FIXED_NOW)
    assert.equal(parsed.ok, true)
    if (!parsed.ok) return
    const validation = validateMarketSignalCandidate(parsed.candidate, { now: FIXED_NOW })
    assert.equal(validation.ok, true)
    if (!validation.ok) return
    assert.equal(validation.candidate.provenance.confidence, "OPERATOR_VERIFIED")
  })
})

// ------------------------------------------------------
// 3. RESPONSE ADAPTERS
// ------------------------------------------------------

describe("buildPartnerMarketSignalResponse", () => {

  function applyResult(): PartnerApplyResultLike {
    return {
      ok: true,
      applied: true,
      diagnostics: [
        { code: "MSI_CANDIDATE_VALID", severity: "info", message: "Validated." },
      ],
      createdSnapshot: {
        id: "snap-1",
        cPrice: 290,
        demandIndex: 1.10,
        source: "MANUAL",
        isActive: true,
        note: "PRICING-FEED-1 | provider=partner-route | …",
        validFrom: "2026-05-09T12:00:00.000Z",
        expiresAt: null,
        createdAt: "2026-05-09T12:00:00.000Z",
      },
    }
  }

  it("preserves legacy top-level snapshot fields", () => {
    const out = buildPartnerMarketSignalResponse(applyResult())
    assert.equal(out.id, "snap-1")
    assert.equal(out.cPrice, 290)
    assert.equal(out.demandIndex, 1.10)
    assert.equal(out.source, "MANUAL")
    assert.equal(out.isActive, true)
    assert.equal(out.note, "PRICING-FEED-1 | provider=partner-route | …")
    assert.equal(out.validFrom, "2026-05-09T12:00:00.000Z")
    assert.equal(out.expiresAt, null)
    assert.equal(out.createdAt, "2026-05-09T12:00:00.000Z")
  })

  it("adds diagnostics + ingestion summary alongside legacy fields", () => {
    const out = buildPartnerMarketSignalResponse(applyResult())
    assert.equal(out.diagnostics.length, 1)
    assert.equal(out.ingestion.ok, true)
    assert.equal(out.ingestion.applied, true)
  })

  it("response shape contains no B2B / contract / demand-intent fields", () => {
    const out = buildPartnerMarketSignalResponse(applyResult())
    const stringified = JSON.stringify(out)
    assert.equal(stringified.includes("clientB2BPricePerKg"), false)
    assert.equal(stringified.includes("lockedPricePerKg"), false)
    assert.equal(stringified.includes("previewPricePerKg"), false)
  })

  it("throws when called without createdSnapshot (defensive)", () => {
    const bad: PartnerApplyResultLike = {
      ok: true, applied: true, diagnostics: [], createdSnapshot: null,
    }
    assert.throws(() => buildPartnerMarketSignalResponse(bad))
  })
})

describe("buildPartnerMarketSignalErrorResponse", () => {

  it("uses the first error-severity diagnostic message as `error`", () => {
    const out = buildPartnerMarketSignalErrorResponse({
      diagnostics: [
        { code: "MSI_PROVENANCE_PARTIAL", severity: "warning", message: "warn" },
        { code: "MSI_CPRICE_OUT_OF_RANGE", severity: "error", message: "cPrice too low" },
        { code: "MSI_INVALID_DEMAND_INDEX", severity: "error", message: "demand bad" },
      ],
    })
    assert.equal(out.error, "cPrice too low")
    assert.equal(out.diagnostics.length, 3)
  })

  it("falls back to a generic message when there are no error-severity diagnostics", () => {
    const out = buildPartnerMarketSignalErrorResponse({
      diagnostics: [
        { code: "MSI_PROVENANCE_PARTIAL", severity: "warning", message: "warn" },
      ],
    })
    assert.equal(out.error, "Invalid market signal candidate.")
  })
})
