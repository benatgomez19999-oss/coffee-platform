//////////////////////////////////////////////////////
// 🧪 B2B ROASTED PRICING — pure tests
//
// No Prisma, no DB, no external IO. The module is a pure
// table lookup with bucket helpers — every test runs in
// node --experimental-strip-types --test.
//////////////////////////////////////////////////////

import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  calculateB2BRoastedPricing,
  getB2BAltitudeBucket,
  getB2BScaBucket,
  normalizeB2BVariety,
} from "../b2bRoastedPricing.ts"

// ------------------------------------------------------
// getB2BAltitudeBucket
// ------------------------------------------------------

describe("getB2BAltitudeBucket", () => {

  it("floors mid-bucket altitudes to the nearest 100 m", () => {
    assert.equal(getB2BAltitudeBucket(1850), 1800)
    assert.equal(getB2BAltitudeBucket(1750), 1700)
    assert.equal(getB2BAltitudeBucket(1650), 1600)
    assert.equal(getB2BAltitudeBucket(1450), 1400)
  })

  it("snaps low altitudes up to 1300", () => {
    assert.equal(getB2BAltitudeBucket(1200), 1300)
    assert.equal(getB2BAltitudeBucket(900), 1300)
    assert.equal(getB2BAltitudeBucket(0), 1300)
  })

  it("caps high altitudes at 2000", () => {
    assert.equal(getB2BAltitudeBucket(2050), 2000)
    assert.equal(getB2BAltitudeBucket(2500), 2000)
    assert.equal(getB2BAltitudeBucket(2000), 2000)
  })

  it("returns the exact bucket on a boundary", () => {
    assert.equal(getB2BAltitudeBucket(1300), 1300)
    assert.equal(getB2BAltitudeBucket(1700), 1700)
  })

  it("returns null for invalid input", () => {
    assert.equal(getB2BAltitudeBucket(null), null)
    assert.equal(getB2BAltitudeBucket(Number.NaN), null)
    assert.equal(getB2BAltitudeBucket(Number.POSITIVE_INFINITY), null)
    assert.equal(getB2BAltitudeBucket(Number.NEGATIVE_INFINITY), null)
    // @ts-expect-error — runtime guard
    assert.equal(getB2BAltitudeBucket("1800"), null)
  })
})

// ------------------------------------------------------
// getB2BScaBucket
// ------------------------------------------------------

describe("getB2BScaBucket", () => {

  it("80–83 inclusive", () => {
    assert.equal(getB2BScaBucket(80), "80_83")
    assert.equal(getB2BScaBucket(81), "80_83")
    assert.equal(getB2BScaBucket(83), "80_83")
  })

  it("84–86 inclusive", () => {
    assert.equal(getB2BScaBucket(84), "84_86")
    assert.equal(getB2BScaBucket(85), "84_86")
    assert.equal(getB2BScaBucket(86), "84_86")
  })

  it("87+ → 86_90_PLUS", () => {
    assert.equal(getB2BScaBucket(87), "86_90_PLUS")
    assert.equal(getB2BScaBucket(91), "86_90_PLUS")
    assert.equal(getB2BScaBucket(95), "86_90_PLUS")
  })

  it("returns null for invalid input", () => {
    assert.equal(getB2BScaBucket(null), null)
    assert.equal(getB2BScaBucket(Number.NaN), null)
    assert.equal(getB2BScaBucket(Number.POSITIVE_INFINITY), null)
  })
})

// ------------------------------------------------------
// normalizeB2BVariety
// ------------------------------------------------------

describe("normalizeB2BVariety", () => {

  it("normalises common forms", () => {
    assert.equal(normalizeB2BVariety("Pink Bourbon"), "PINK_BOURBON")
    assert.equal(normalizeB2BVariety("pink_bourbon"), "PINK_BOURBON")
    assert.equal(normalizeB2BVariety("pink-bourbon"), "PINK_BOURBON")
    assert.equal(normalizeB2BVariety("Geisha"), "GEISHA")
    assert.equal(normalizeB2BVariety("CASTILLO"), "CASTILLO")
    assert.equal(normalizeB2BVariety("  caturra  "), "CATURRA")
  })

  it("returns null for unsupported / empty input", () => {
    assert.equal(normalizeB2BVariety("Wush Wush"), null)
    assert.equal(normalizeB2BVariety("Sudan Rume"), null)
    assert.equal(normalizeB2BVariety(""), null)
    assert.equal(normalizeB2BVariety("   "), null)
    // @ts-expect-error — runtime guard
    assert.equal(normalizeB2BVariety(null), null)
  })
})

// ------------------------------------------------------
// calculateB2BRoastedPricing — exact founder-table values
// ------------------------------------------------------

describe("calculateB2BRoastedPricing — founder-reference table values", () => {

  it("Geisha SCA 88 @ altitude 2050 → €200/kg roasted", () => {
    const r = calculateB2BRoastedPricing({
      altitude: 2050, variety: "Geisha", scaScore: 88,
    })
    assert.equal(r.pricePerKgRoasted, 200)
    assert.equal(r.altitudeBucket, 2000)
    assert.equal(r.scaBucket, "86_90_PLUS")
    assert.equal(r.fallbackReason, undefined)
    assert.equal(r.currency, "EUR")
  })

  it("Pink Bourbon SCA 87 @ altitude 1650 → €50/kg roasted", () => {
    const r = calculateB2BRoastedPricing({
      altitude: 1650, variety: "Pink Bourbon", scaScore: 87,
    })
    assert.equal(r.pricePerKgRoasted, 50)
    assert.equal(r.altitudeBucket, 1600)
    assert.equal(r.scaBucket, "86_90_PLUS")
  })

  it("Bourbon SCA 86 @ altitude 1850 → €38/kg roasted", () => {
    const r = calculateB2BRoastedPricing({
      altitude: 1850, variety: "Bourbon", scaScore: 86,
    })
    assert.equal(r.pricePerKgRoasted, 38)
    assert.equal(r.altitudeBucket, 1800)
    assert.equal(r.scaBucket, "84_86")
  })

  it("Castillo SCA 83 @ altitude 1850 → €28/kg roasted", () => {
    const r = calculateB2BRoastedPricing({
      altitude: 1850, variety: "Castillo", scaScore: 83,
    })
    assert.equal(r.pricePerKgRoasted, 28)
    assert.equal(r.altitudeBucket, 1800)
    assert.equal(r.scaBucket, "80_83")
  })

  it("Castillo SCA 83 @ altitude 1650 → €24/kg roasted", () => {
    const r = calculateB2BRoastedPricing({
      altitude: 1650, variety: "Castillo", scaScore: 83,
    })
    assert.equal(r.pricePerKgRoasted, 24)
    assert.equal(r.altitudeBucket, 1600)
  })

  it("Castillo SCA 81 @ altitude 1750 → €26/kg roasted", () => {
    const r = calculateB2BRoastedPricing({
      altitude: 1750, variety: "Castillo", scaScore: 81,
    })
    assert.equal(r.pricePerKgRoasted, 26)
    assert.equal(r.altitudeBucket, 1700)
    assert.equal(r.scaBucket, "80_83")
  })
})

// ------------------------------------------------------
// calculateB2BRoastedPricing — null table cells
// ------------------------------------------------------

describe("calculateB2BRoastedPricing — null table cells", () => {

  it("Geisha SCA 82 → UNAVAILABLE_FOR_SCA_BUCKET", () => {
    const r = calculateB2BRoastedPricing({
      altitude: 1800, variety: "Geisha", scaScore: 82,
    })
    assert.equal(r.pricePerKgRoasted, null)
    assert.equal(r.fallbackReason, "UNAVAILABLE_FOR_SCA_BUCKET")
    assert.equal(r.scaBucket, "80_83")
    assert.equal(r.variety, "GEISHA")
  })

  it("Pink Bourbon SCA 81 → UNAVAILABLE_FOR_SCA_BUCKET", () => {
    const r = calculateB2BRoastedPricing({
      altitude: 1500, variety: "Pink Bourbon", scaScore: 81,
    })
    assert.equal(r.pricePerKgRoasted, null)
    assert.equal(r.fallbackReason, "UNAVAILABLE_FOR_SCA_BUCKET")
  })
})

// ------------------------------------------------------
// calculateB2BRoastedPricing — missing inputs
// ------------------------------------------------------

describe("calculateB2BRoastedPricing — missing inputs", () => {

  it("MISSING_ALTITUDE when altitude is null", () => {
    const r = calculateB2BRoastedPricing({
      altitude: null, variety: "Castillo", scaScore: 84,
    })
    assert.equal(r.pricePerKgRoasted, null)
    assert.equal(r.fallbackReason, "MISSING_ALTITUDE")
  })

  it("MISSING_SCA when scaScore is null", () => {
    const r = calculateB2BRoastedPricing({
      altitude: 1800, variety: "Castillo", scaScore: null,
    })
    assert.equal(r.pricePerKgRoasted, null)
    assert.equal(r.fallbackReason, "MISSING_SCA")
  })

  it("UNSUPPORTED_VARIETY when variety is not in the table", () => {
    const r = calculateB2BRoastedPricing({
      altitude: 1800, variety: "Wush Wush", scaScore: 90,
    })
    assert.equal(r.pricePerKgRoasted, null)
    assert.equal(r.fallbackReason, "UNSUPPORTED_VARIETY")
  })

  it("priority — altitude is checked before SCA", () => {
    const r = calculateB2BRoastedPricing({
      altitude: null, variety: "Castillo", scaScore: null,
    })
    assert.equal(r.fallbackReason, "MISSING_ALTITUDE")
  })

  it("priority — SCA is checked before variety", () => {
    const r = calculateB2BRoastedPricing({
      altitude: 1800, variety: "Wush Wush", scaScore: null,
    })
    assert.equal(r.fallbackReason, "MISSING_SCA")
  })
})

// ------------------------------------------------------
// calculateB2BRoastedPricing — metadata
// ------------------------------------------------------

describe("calculateB2BRoastedPricing — metadata + currency", () => {

  it("currency is always EUR (table is EUR-denominated, input.currency reserved for future FX)", () => {
    const r1 = calculateB2BRoastedPricing({
      altitude: 1800, variety: "Castillo", scaScore: 84,
    })
    assert.equal(r1.currency, "EUR")

    const r2 = calculateB2BRoastedPricing({
      altitude: 1800, variety: "Castillo", scaScore: 84, currency: "USD",
    })
    assert.equal(r2.currency, "EUR")
  })

  it("pricingVersion + source are stable", () => {
    const r = calculateB2BRoastedPricing({
      altitude: 1800, variety: "Castillo", scaScore: 84,
    })
    assert.equal(r.pricingVersion, "b2b-roasted-reference-v0")
    assert.equal(r.source, "founder-reference-table")
  })

  it("breakdown carries raw + bucket values for audit", () => {
    const r = calculateB2BRoastedPricing({
      altitude: 1850, variety: "Castillo", scaScore: 83,
    })
    const labels = r.breakdown.map((s) => s.label)
    assert.ok(labels.includes("altitudeRaw"))
    assert.ok(labels.includes("altitudeBucket"))
    assert.ok(labels.includes("scaRaw"))
    assert.ok(labels.includes("scaBucket"))
    assert.ok(labels.includes("varietyResolved"))
    assert.ok(labels.includes("tableCell"))
    assert.ok(labels.includes("pricePerKgRoasted"))
  })
})
