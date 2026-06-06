//////////////////////////////////////////////////////
// 🧪 MARKET SIGNAL INGESTION — PURE TESTS
//
// Pure tests, no Prisma. Validates ingestion candidate
// + provenance note builder without DB.
//////////////////////////////////////////////////////

import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  buildMarketSignalProvenanceNote,
  validateMarketSignalCandidate,
} from "../marketSignalIngestion.pure.ts"
import type {
  MarketSignalIngestionCandidate,
  NormalizedMarketSignalCandidate,
} from "../marketSignalIngestion.types.ts"

const FIXED_NOW = new Date("2026-05-09T12:00:00.000Z")
const FUTURE_DATE = new Date("2026-05-15T12:00:00.000Z")
const PAST_DATE = new Date("2026-05-01T12:00:00.000Z")

function base(over: Partial<MarketSignalIngestionCandidate> = {}): MarketSignalIngestionCandidate {
  return {
    cPrice: 290,
    demandIndex: 1.10,
    source: "MANUAL",
    note: null,
    validFrom: FIXED_NOW,
    expiresAt: FUTURE_DATE,
    provenance: {
      provider: "manual",
      sourceName: "Operator dashboard",
      sourceUrl: null,
      retrievedAt: FIXED_NOW,
      rawValue: 290,
      rawUnit: "US_CENTS_PER_LB",
      confidence: "OPERATOR_VERIFIED",
    },
    ...over,
  }
}

// ------------------------------------------------------
// 1. HAPPY PATH
// ------------------------------------------------------

describe("validateMarketSignalCandidate — happy path", () => {

  it("accepts a fully-populated valid candidate", () => {
    const result = validateMarketSignalCandidate(base(), { now: FIXED_NOW })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.candidate.cPrice, 290)
    assert.equal(result.candidate.demandIndex, 1.10)
    assert.equal(result.candidate.source, "MANUAL")
    assert.equal(result.candidate.expiresAt?.toISOString(), FUTURE_DATE.toISOString())
    assert.equal(result.candidate.provenance.confidence, "OPERATOR_VERIFIED")
    assert.ok(result.candidate.diagnostics.some((d) => d.code === "MSI_CANDIDATE_VALID"))
  })

  it("validFrom defaults to now when missing", () => {
    const result = validateMarketSignalCandidate(
      base({ validFrom: null }),
      { now: FIXED_NOW },
    )
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.candidate.validFrom.toISOString(), FIXED_NOW.toISOString())
  })

  it("expiresAt null is allowed and emits a warning diagnostic", () => {
    const result = validateMarketSignalCandidate(
      base({ expiresAt: null }),
      { now: FIXED_NOW },
    )
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.candidate.expiresAt, null)
    assert.ok(
      result.candidate.diagnostics.some(
        (d) => d.severity === "warning" && /expiresAt missing/.test(d.message),
      ),
    )
  })

  it("missing provenance yields a warning but still ok", () => {
    const result = validateMarketSignalCandidate(
      base({ provenance: undefined }),
      { now: FIXED_NOW },
    )
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.ok(
      result.candidate.diagnostics.some((d) => d.code === "MSI_PROVENANCE_MISSING" && d.severity === "warning"),
    )
    // Defaults survive provenance-missing path.
    assert.equal(result.candidate.provenance.rawUnit, "US_CENTS_PER_LB")
    assert.equal(result.candidate.provenance.confidence, "MEDIUM")
  })
})

// ------------------------------------------------------
// 2. cPrice rejection
// ------------------------------------------------------

describe("validateMarketSignalCandidate — cPrice", () => {

  it("rejects cPrice below 50", () => {
    const r = validateMarketSignalCandidate(base({ cPrice: 49 }), { now: FIXED_NOW })
    assert.equal(r.ok, false)
    if (r.ok) return
    assert.ok(r.diagnostics.some((d) => d.code === "MSI_CPRICE_OUT_OF_RANGE"))
  })

  it("rejects cPrice above 600", () => {
    const r = validateMarketSignalCandidate(base({ cPrice: 601 }), { now: FIXED_NOW })
    assert.equal(r.ok, false)
    if (r.ok) return
    assert.ok(r.diagnostics.some((d) => d.code === "MSI_CPRICE_OUT_OF_RANGE"))
  })

  it("rejects non-finite cPrice (NaN, Infinity)", () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const r = validateMarketSignalCandidate(base({ cPrice: bad }), { now: FIXED_NOW })
      assert.equal(r.ok, false, `expected reject for ${bad}`)
      if (r.ok) continue
      assert.ok(r.diagnostics.some((d) => d.code === "MSI_INVALID_CPRICE"))
    }
  })

  it("rejects non-number cPrice", () => {
    const r = validateMarketSignalCandidate(
      // @ts-expect-error — runtime guard
      base({ cPrice: "290" }),
      { now: FIXED_NOW },
    )
    assert.equal(r.ok, false)
  })

  it("does NOT silently clamp 49 → 50", () => {
    // Ensures no future change introduces silent clamping.
    const r = validateMarketSignalCandidate(base({ cPrice: 49 }), { now: FIXED_NOW })
    assert.equal(r.ok, false)
  })
})

// ------------------------------------------------------
// 3. demandIndex rejection
// ------------------------------------------------------

describe("validateMarketSignalCandidate — demandIndex", () => {

  it("rejects demandIndex below 0.8", () => {
    const r = validateMarketSignalCandidate(base({ demandIndex: 0.79 }), { now: FIXED_NOW })
    assert.equal(r.ok, false)
    if (r.ok) return
    assert.ok(r.diagnostics.some((d) => d.code === "MSI_DEMAND_INDEX_OUT_OF_RANGE"))
  })

  it("rejects demandIndex above 1.2", () => {
    const r = validateMarketSignalCandidate(base({ demandIndex: 1.21 }), { now: FIXED_NOW })
    assert.equal(r.ok, false)
    if (r.ok) return
    assert.ok(r.diagnostics.some((d) => d.code === "MSI_DEMAND_INDEX_OUT_OF_RANGE"))
  })

  it("rejects non-finite demandIndex", () => {
    const r = validateMarketSignalCandidate(base({ demandIndex: Number.NaN }), { now: FIXED_NOW })
    assert.equal(r.ok, false)
    if (r.ok) return
    assert.ok(r.diagnostics.some((d) => d.code === "MSI_INVALID_DEMAND_INDEX"))
  })
})

// ------------------------------------------------------
// 4. source / dates rejection
// ------------------------------------------------------

describe("validateMarketSignalCandidate — source + dates", () => {

  it("rejects an unrecognised source", () => {
    const r = validateMarketSignalCandidate(
      // @ts-expect-error
      base({ source: "MAGIC" }),
      { now: FIXED_NOW },
    )
    assert.equal(r.ok, false)
    if (r.ok) return
    assert.ok(r.diagnostics.some((d) => d.code === "MSI_INVALID_SOURCE"))
  })

  it("rejects expiresAt before validFrom", () => {
    const r = validateMarketSignalCandidate(
      base({ validFrom: FUTURE_DATE, expiresAt: FIXED_NOW }),
      { now: PAST_DATE },
    )
    assert.equal(r.ok, false)
    if (r.ok) return
    assert.ok(r.diagnostics.some((d) => d.code === "MSI_EXPIRES_BEFORE_VALID_FROM"))
  })

  it("rejects expiresAt in the past", () => {
    const r = validateMarketSignalCandidate(
      base({ expiresAt: PAST_DATE }),
      { now: FIXED_NOW },
    )
    assert.equal(r.ok, false)
    if (r.ok) return
    assert.ok(r.diagnostics.some((d) => d.code === "MSI_EXPIRES_IN_PAST"))
  })

  it("rejects an invalid date string for validFrom", () => {
    const r = validateMarketSignalCandidate(
      base({ validFrom: "not-a-date" }),
      { now: FIXED_NOW },
    )
    assert.equal(r.ok, false)
    if (r.ok) return
    assert.ok(r.diagnostics.some((d) => d.code === "MSI_INVALID_VALID_FROM"))
  })

  it("rejects an invalid date string for expiresAt", () => {
    const r = validateMarketSignalCandidate(
      base({ expiresAt: "not-a-date" }),
      { now: FIXED_NOW },
    )
    assert.equal(r.ok, false)
    if (r.ok) return
    assert.ok(r.diagnostics.some((d) => d.code === "MSI_INVALID_EXPIRES_AT"))
  })
})

// ------------------------------------------------------
// 5. PROVENANCE NOTE BUILDER
// ------------------------------------------------------

describe("buildMarketSignalProvenanceNote", () => {

  function validCandidate(): NormalizedMarketSignalCandidate {
    const result = validateMarketSignalCandidate(base(), { now: FIXED_NOW })
    if (!result.ok) throw new Error("fixture should validate")
    return result.candidate
  }

  it("includes provider / sourceName / confidence / rawUnit", () => {
    const note = buildMarketSignalProvenanceNote(validCandidate(), FIXED_NOW)
    assert.match(note, /provider=manual/)
    assert.match(note, /sourceName=Operator dashboard/)
    assert.match(note, /confidence=OPERATOR_VERIFIED/)
    assert.match(note, /rawUnit=US_CENTS_PER_LB/)
    assert.match(note, /^PRICING-FEED-1 \|/)
    assert.match(note, /cPrice=290/)
    assert.match(note, /demandIndex=1.1/)
  })

  it("preserves the user note if present, escaping quotes", () => {
    const result = validateMarketSignalCandidate(
      base({ note: 'Operator says "watch ICE July"' }),
      { now: FIXED_NOW },
    )
    assert.equal(result.ok, true)
    if (!result.ok) return
    const note = buildMarketSignalProvenanceNote(result.candidate, FIXED_NOW)
    assert.match(note, /userNote="Operator says \\"watch ICE July\\""/)
  })

  it("falls back to retrievedAtFallback when provenance.retrievedAt is null", () => {
    const result = validateMarketSignalCandidate(
      base({
        provenance: {
          provider: "manual",
          sourceName: "Manual",
          sourceUrl: null,
          retrievedAt: null,
          rawValue: null,
          rawUnit: "US_CENTS_PER_LB",
          confidence: "MEDIUM",
        },
      }),
      { now: FIXED_NOW },
    )
    assert.equal(result.ok, true)
    if (!result.ok) return
    const note = buildMarketSignalProvenanceNote(result.candidate, FIXED_NOW)
    assert.match(note, /retrievedAt=2026-05-09T12:00:00\.000Z/)
  })
})
