//////////////////////////////////////////////////////
// 🧪 MARKET TARGET PRICING — pure tests
//
// No Prisma, no fetch, no Date.now-dependent assertions.
// Run via the existing `npm run test:allocation` glob,
// which already covers src/engine/pricing/client/__tests__/.
//////////////////////////////////////////////////////

import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  MARKET_TARGET_SOURCE_VERSION,
  classifyMarketPricingVariety,
  getMarketTargetPricing,
  normalizeMarketTargetVariety,
} from "../marketTargetPricing.ts"

// ------------------------------------------------------
// 1. normalizeMarketTargetVariety
// ------------------------------------------------------

describe("normalizeMarketTargetVariety", () => {

  it("normalises canonical forms", () => {
    assert.equal(normalizeMarketTargetVariety("CASTILLO"), "CASTILLO")
    assert.equal(normalizeMarketTargetVariety("Castillo"), "CASTILLO")
    assert.equal(normalizeMarketTargetVariety("castillo"), "CASTILLO")
    assert.equal(normalizeMarketTargetVariety("CATURRA"), "CATURRA")
    assert.equal(normalizeMarketTargetVariety("COLOMBIA"), "COLOMBIA")
    assert.equal(normalizeMarketTargetVariety("TYPICA"), "TYPICA")
    assert.equal(normalizeMarketTargetVariety("BOURBON"), "BOURBON")
    assert.equal(normalizeMarketTargetVariety("TABI"), "TABI")
  })

  it("handles Pink Bourbon spacing variants", () => {
    assert.equal(normalizeMarketTargetVariety("Pink Bourbon"), "PINK_BOURBON")
    assert.equal(normalizeMarketTargetVariety("pink-bourbon"), "PINK_BOURBON")
    assert.equal(normalizeMarketTargetVariety("pink bourbon"), "PINK_BOURBON")
    assert.equal(normalizeMarketTargetVariety("PINK_BOURBON"), "PINK_BOURBON")
  })

  it("accepts both Geisha and Gesha spellings", () => {
    assert.equal(normalizeMarketTargetVariety("Geisha"), "GEISHA")
    assert.equal(normalizeMarketTargetVariety("GEISHA"), "GEISHA")
    assert.equal(normalizeMarketTargetVariety("Gesha"), "GEISHA")
    assert.equal(normalizeMarketTargetVariety("gesha"), "GEISHA")
  })

  it("rejects unsupported varieties + empty input", () => {
    assert.equal(normalizeMarketTargetVariety("Wush Wush"), null)
    assert.equal(normalizeMarketTargetVariety("WUSH_WUSH"), null)
    assert.equal(normalizeMarketTargetVariety("Sudan Rume"), null)
    assert.equal(normalizeMarketTargetVariety("SUDAN_RUME"), null)
    assert.equal(normalizeMarketTargetVariety("Pacamara"), null)
    assert.equal(normalizeMarketTargetVariety(""), null)
    assert.equal(normalizeMarketTargetVariety("   "), null)
    // @ts-expect-error — runtime guard
    assert.equal(normalizeMarketTargetVariety(null), null)
  })
})

// ------------------------------------------------------
// 2. classifyMarketPricingVariety
// ------------------------------------------------------

describe("classifyMarketPricingVariety", () => {
  it("buckets the 8 supported varieties correctly", () => {
    assert.equal(classifyMarketPricingVariety("CASTILLO"), "NORMAL_SPECIALTY")
    assert.equal(classifyMarketPricingVariety("CATURRA"),  "NORMAL_SPECIALTY")
    assert.equal(classifyMarketPricingVariety("COLOMBIA"), "NORMAL_SPECIALTY")
    assert.equal(classifyMarketPricingVariety("TYPICA"),   "PREMIUM_SPECIALTY")
    assert.equal(classifyMarketPricingVariety("BOURBON"),  "PREMIUM_SPECIALTY")
    assert.equal(classifyMarketPricingVariety("TABI"),     "PREMIUM_SPECIALTY")
    assert.equal(classifyMarketPricingVariety("PINK_BOURBON"), "RARE_PINK_BOURBON")
    assert.equal(classifyMarketPricingVariety("GEISHA"),   "ULTRA_RARE_GEISHA")
  })
})

// ------------------------------------------------------
// 3. NORMAL / PREMIUM SPECIALTY targets
// ------------------------------------------------------

describe("getMarketTargetPricing — normal varieties", () => {

  it("Castillo SCA 83 → 22 / 28 / 35", () => {
    const r = getMarketTargetPricing({ variety: "Castillo", scaScore: 83 })
    assert.ok(r.ok)
    assert.equal(r.pricingClass, "NORMAL_SPECIALTY")
    assert.equal(r.band.low, 22)
    assert.equal(r.band.expected, 28)
    assert.equal(r.band.high, 35)
    assert.equal(r.bucket.scaBucket, "80_83")
    assert.equal(r.bucket.altitudeBucket, null)
    assert.equal(r.bucket.countryGroup, null)
    assert.equal(r.confidence, "medium-high")
    assert.ok(r.reasons.includes("NORMAL_TABLE_MATCH"))
    assert.ok(r.reasons.includes("SCA_BUCKETED"))
  })

  it("Castillo SCA 86 → 32 / 40 / 50", () => {
    const r = getMarketTargetPricing({ variety: "Castillo", scaScore: 86 })
    assert.ok(r.ok)
    assert.equal(r.band.low, 32)
    assert.equal(r.band.expected, 40)
    assert.equal(r.band.high, 50)
    assert.equal(r.bucket.scaBucket, "84_86")
  })

  it("Bourbon SCA 90 → 80 / 105 / 135", () => {
    const r = getMarketTargetPricing({ variety: "Bourbon", scaScore: 90 })
    assert.ok(r.ok)
    assert.equal(r.pricingClass, "PREMIUM_SPECIALTY")
    assert.equal(r.band.low, 80)
    assert.equal(r.band.expected, 105)
    assert.equal(r.band.high, 135)
    assert.equal(r.confidence, "medium")
  })

  it("Tabi SCA 91 → 100 / 135 / 175", () => {
    const r = getMarketTargetPricing({ variety: "Tabi", scaScore: 91 })
    assert.ok(r.ok)
    assert.equal(r.band.low, 100)
    assert.equal(r.band.expected, 135)
    assert.equal(r.band.high, 175)
    assert.equal(r.bucket.scaBucket, "91_PLUS")
  })

  it("normal varieties don't carry altitudeBucket or countryGroup", () => {
    const r = getMarketTargetPricing({
      variety: "Caturra",
      scaScore: 85,
      altitude: 1700,
      country: "Colombia",
    })
    assert.ok(r.ok)
    assert.equal(r.bucket.altitudeBucket, null)
    assert.equal(r.bucket.countryGroup, null)
  })

  it("normal Colombia 91+ stays slightly below other origins (research delta)", () => {
    const colombia = getMarketTargetPricing({ variety: "Colombia", scaScore: 92 })
    const castillo = getMarketTargetPricing({ variety: "Castillo", scaScore: 92 })
    assert.ok(colombia.ok && castillo.ok)
    assert.equal(colombia.band.expected, 115)
    assert.equal(castillo.band.expected, 120)
  })
})

// ------------------------------------------------------
// 4. PINK BOURBON targets
// ------------------------------------------------------

describe("getMarketTargetPricing — Pink Bourbon", () => {

  it("Colombia 1700m SCA 87 → 55 / 70 / 85", () => {
    const r = getMarketTargetPricing({
      variety: "Pink Bourbon", country: "Colombia", altitude: 1700, scaScore: 87,
    })
    assert.ok(r.ok)
    assert.equal(r.pricingClass, "RARE_PINK_BOURBON")
    assert.equal(r.band.low, 55)
    assert.equal(r.band.expected, 70)
    assert.equal(r.band.high, 85)
    assert.equal(r.bucket.altitudeBucket, "COLOMBIA_1700")
    assert.equal(r.bucket.countryGroup, "COLOMBIA")
    assert.ok(r.reasons.includes("PINK_BOURBON_TABLE_MATCH"))
    assert.ok(r.reasons.includes("ALTITUDE_BUCKETED"))
  })

  it("Colombia 1900m SCA 90 → 125 / 150 / 180", () => {
    const r = getMarketTargetPricing({
      variety: "Pink Bourbon", country: "Colombia", altitude: 1900, scaScore: 90,
    })
    assert.ok(r.ok)
    assert.equal(r.band.low, 125)
    assert.equal(r.band.expected, 150)
    assert.equal(r.band.high, 180)
    assert.equal(r.bucket.altitudeBucket, "COLOMBIA_1900")
  })

  it("Colombia 2000m SCA 91 → 165 / 200 / 235", () => {
    const r = getMarketTargetPricing({
      variety: "Pink Bourbon", country: "Colombia", altitude: 2000, scaScore: 91,
    })
    assert.ok(r.ok)
    assert.equal(r.band.low, 165)
    assert.equal(r.band.expected, 200)
    assert.equal(r.band.high, 235)
    assert.equal(r.bucket.altitudeBucket, "COLOMBIA_2000")
    assert.equal(r.bucket.scaBucket, "91_PLUS")
  })

  it("Panama SCA 90 → 160 / 195 / 235", () => {
    const r = getMarketTargetPricing({
      variety: "Pink Bourbon", country: "Panama", scaScore: 90,
    })
    assert.ok(r.ok)
    assert.equal(r.band.low, 160)
    assert.equal(r.band.expected, 195)
    assert.equal(r.band.high, 235)
    assert.equal(r.bucket.altitudeBucket, "PANAMA")
    assert.equal(r.bucket.countryGroup, "PANAMA")
  })

  it("Costa Rica SCA 91 → 175 / 215 / 260", () => {
    const r = getMarketTargetPricing({
      variety: "Pink Bourbon", country: "Costa Rica", scaScore: 91,
    })
    assert.ok(r.ok)
    assert.equal(r.band.low, 175)
    assert.equal(r.band.expected, 215)
    assert.equal(r.band.high, 260)
    assert.equal(r.bucket.altitudeBucket, "COSTA_RICA")
    assert.equal(r.bucket.countryGroup, "COSTA_RICA")
  })

  it("unknown country falls back to Colombia 1900m + COUNTRY_GROUPED", () => {
    const r = getMarketTargetPricing({
      variety: "Pink Bourbon", country: "Atlantis", scaScore: 89,
    })
    assert.ok(r.ok)
    assert.equal(r.bucket.altitudeBucket, "COLOMBIA_1900")
    assert.equal(r.bucket.countryGroup, "COLOMBIA")
    assert.ok(r.reasons.includes("COUNTRY_GROUPED"))
    // Colombia 1900 SCA 89 = 100 / 125 / 155
    assert.equal(r.band.expected, 125)
  })

  it("missing altitude on Colombia falls back to 1900m + MISSING_ALTITUDE", () => {
    const r = getMarketTargetPricing({
      variety: "Pink Bourbon", country: "Colombia", scaScore: 89, // altitude omitted
    })
    assert.ok(r.ok)
    assert.equal(r.bucket.altitudeBucket, "COLOMBIA_1900")
    assert.ok(r.reasons.includes("MISSING_ALTITUDE"))
    assert.ok(r.reasons.includes("ALTITUDE_BUCKETED"))
  })
})

// ------------------------------------------------------
// 5. GEISHA targets
// ------------------------------------------------------

describe("getMarketTargetPricing — Geisha", () => {

  it("Colombia 1800m SCA 88 → expected 160", () => {
    const r = getMarketTargetPricing({
      variety: "Geisha", country: "Colombia", altitude: 1800, scaScore: 88,
    })
    assert.ok(r.ok)
    assert.equal(r.pricingClass, "ULTRA_RARE_GEISHA")
    assert.equal(r.band.expected, 160)
    assert.equal(r.bucket.altitudeBucket, "COLOMBIA_1800")
    assert.ok(r.reasons.includes("GEISHA_TABLE_MATCH"))
    assert.ok(r.reasons.includes("ALTITUDE_BUCKETED"))
  })

  it("Colombia 2000m SCA 90 → expected 295", () => {
    const r = getMarketTargetPricing({
      variety: "Geisha", country: "Colombia", altitude: 2000, scaScore: 90,
    })
    assert.ok(r.ok)
    assert.equal(r.band.expected, 295)
    assert.equal(r.bucket.altitudeBucket, "COLOMBIA_2000")
  })

  it("Colombia 2050m+ SCA 91 → expected 400", () => {
    const r = getMarketTargetPricing({
      variety: "Geisha", country: "Colombia", altitude: 2050, scaScore: 91,
    })
    assert.ok(r.ok)
    assert.equal(r.band.expected, 400)
    assert.equal(r.bucket.altitudeBucket, "COLOMBIA_2050_PLUS")
  })

  it("Colombia 2050m+ SCA 88 → expected 200 (sample from spec)", () => {
    const r = getMarketTargetPricing({
      variety: "Geisha", country: "Colombia", altitude: 2050, scaScore: 88,
    })
    assert.ok(r.ok)
    assert.equal(r.band.expected, 200)
    assert.equal(r.bucket.altitudeBucket, "COLOMBIA_2050_PLUS")
    assert.equal(r.bucket.scaBucket, "88")
    assert.equal(r.bucket.countryGroup, "COLOMBIA")
  })

  it("Panama non-famous SCA 90 → expected 615", () => {
    const r = getMarketTargetPricing({
      variety: "Geisha", country: "Panama", scaScore: 90,
    })
    assert.ok(r.ok)
    assert.equal(r.band.expected, 615)
    assert.equal(r.bucket.altitudeBucket, "PANAMA_NON_FAMOUS")
    assert.equal(r.bucket.producerPrestigeTier, "UNKNOWN")
  })

  it("Panama FAMOUS_ESTATE SCA 90 → expected 1250", () => {
    const r = getMarketTargetPricing({
      variety: "Geisha", country: "Panama", scaScore: 90,
      producerPrestigeTier: "FAMOUS_ESTATE",
    })
    assert.ok(r.ok)
    assert.equal(r.band.expected, 1250)
    assert.equal(r.bucket.altitudeBucket, "PANAMA_FAMOUS")
    assert.equal(r.bucket.producerPrestigeTier, "FAMOUS_ESTATE")
    assert.ok(r.reasons.includes("PRESTIGE_TIER_APPLIED"))
  })

  it("Panama STANDARD prestige still selects non-famous estate row", () => {
    const r = getMarketTargetPricing({
      variety: "Geisha", country: "Panama", scaScore: 90,
      producerPrestigeTier: "STANDARD",
    })
    assert.ok(r.ok)
    assert.equal(r.bucket.altitudeBucket, "PANAMA_NON_FAMOUS")
    assert.equal(r.band.expected, 615)
  })

  it("Ethiopia SCA 91 → expected 760", () => {
    const r = getMarketTargetPricing({
      variety: "Geisha", country: "Ethiopia", scaScore: 91,
    })
    assert.ok(r.ok)
    assert.equal(r.band.expected, 760)
    assert.equal(r.bucket.altitudeBucket, "ETHIOPIA_NAMED")
  })

  it("Costa Rica SCA 93 → expected 810 (93_PLUS bucket)", () => {
    const r = getMarketTargetPricing({
      variety: "Geisha", country: "Costa Rica", scaScore: 93,
    })
    assert.ok(r.ok)
    assert.equal(r.band.expected, 810)
    assert.equal(r.bucket.altitudeBucket, "COSTA_RICA_BOLIVIA_ECUADOR")
    assert.equal(r.bucket.scaBucket, "93_PLUS")
  })

  it("unknown country falls back to Colombia 2000m + COUNTRY_GROUPED", () => {
    const r = getMarketTargetPricing({
      variety: "Geisha", country: "Atlantis", scaScore: 90,
    })
    assert.ok(r.ok)
    assert.equal(r.bucket.altitudeBucket, "COLOMBIA_2000")
    assert.equal(r.bucket.countryGroup, "COLOMBIA")
    assert.ok(r.reasons.includes("COUNTRY_GROUPED"))
    // Colombia 2000 SCA 90 expected = 295.
    assert.equal(r.band.expected, 295)
  })

  it("missing altitude on Colombia falls back to 2000m + MISSING_ALTITUDE", () => {
    const r = getMarketTargetPricing({
      variety: "Geisha", country: "Colombia", scaScore: 90,
    })
    assert.ok(r.ok)
    assert.equal(r.bucket.altitudeBucket, "COLOMBIA_2000")
    assert.ok(r.reasons.includes("MISSING_ALTITUDE"))
    assert.ok(r.reasons.includes("ALTITUDE_BUCKETED"))
  })
})

// ------------------------------------------------------
// 6. SCA edge cases
// ------------------------------------------------------

describe("getMarketTargetPricing — SCA edge cases", () => {

  it("null SCA → ok:false with MISSING_SCA", () => {
    const r = getMarketTargetPricing({ variety: "Castillo", scaScore: null })
    assert.equal(r.ok, false)
    if (!r.ok) assert.ok(r.reasons.includes("MISSING_SCA"))
  })

  it("undefined SCA → ok:false with MISSING_SCA", () => {
    const r = getMarketTargetPricing({ variety: "Castillo" })
    assert.equal(r.ok, false)
    if (!r.ok) assert.ok(r.reasons.includes("MISSING_SCA"))
  })

  it("non-finite SCA → ok:false with MISSING_SCA", () => {
    const r1 = getMarketTargetPricing({ variety: "Castillo", scaScore: Number.NaN })
    const r2 = getMarketTargetPricing({ variety: "Castillo", scaScore: Number.POSITIVE_INFINITY })
    assert.equal(r1.ok, false)
    assert.equal(r2.ok, false)
  })

  it("SCA 75 (below floor) → 80_83 bucket + SCA_CLAMPED_LOW (normal table)", () => {
    const r = getMarketTargetPricing({ variety: "Castillo", scaScore: 75 })
    assert.ok(r.ok)
    assert.equal(r.bucket.scaBucket, "80_83")
    assert.ok(r.reasons.includes("SCA_CLAMPED_LOW"))
  })

  it("SCA 80 (Pink Bourbon, below 87 floor) → '87' bucket + SCA_CLAMPED_LOW", () => {
    const r = getMarketTargetPricing({
      variety: "Pink Bourbon", country: "Colombia", altitude: 1700, scaScore: 80,
    })
    assert.ok(r.ok)
    assert.equal(r.bucket.scaBucket, "87")
    assert.ok(r.reasons.includes("SCA_CLAMPED_LOW"))
  })

  it("SCA 99 → top bucket + SCA_CLAMPED_HIGH (normal)", () => {
    const r = getMarketTargetPricing({ variety: "Castillo", scaScore: 99 })
    assert.ok(r.ok)
    assert.equal(r.bucket.scaBucket, "91_PLUS")
    assert.ok(r.reasons.includes("SCA_CLAMPED_HIGH"))
  })

  it("SCA 99 → 93_PLUS bucket + SCA_CLAMPED_HIGH (Geisha)", () => {
    const r = getMarketTargetPricing({
      variety: "Geisha", country: "Colombia", altitude: 2000, scaScore: 99,
    })
    assert.ok(r.ok)
    assert.equal(r.bucket.scaBucket, "93_PLUS")
    assert.ok(r.reasons.includes("SCA_CLAMPED_HIGH"))
  })

  it("SCA 88.4 rounds to 88 (Geisha bucket '88')", () => {
    const r = getMarketTargetPricing({
      variety: "Geisha", country: "Colombia", altitude: 1800, scaScore: 88.4,
    })
    assert.ok(r.ok)
    assert.equal(r.bucket.scaBucket, "88")
    assert.equal(r.band.expected, 160)
  })

  it("SCA 88.6 rounds to 89 (Geisha bucket '89')", () => {
    const r = getMarketTargetPricing({
      variety: "Geisha", country: "Colombia", altitude: 1800, scaScore: 88.6,
    })
    assert.ok(r.ok)
    assert.equal(r.bucket.scaBucket, "89")
    assert.equal(r.band.expected, 200)
  })
})

// ------------------------------------------------------
// 7. Result invariants
// ------------------------------------------------------

describe("getMarketTargetPricing — result invariants", () => {

  it("sourceVersion is research-2026-05 on success", () => {
    const r = getMarketTargetPricing({ variety: "Castillo", scaScore: 84 })
    assert.equal(r.sourceVersion, MARKET_TARGET_SOURCE_VERSION)
    assert.equal(r.sourceVersion, "research-2026-05")
  })

  it("sourceVersion is research-2026-05 on failure", () => {
    const r = getMarketTargetPricing({ variety: "Wush Wush", scaScore: 88 })
    assert.equal(r.sourceVersion, MARKET_TARGET_SOURCE_VERSION)
  })

  it("never throws on malformed input", () => {
    // @ts-expect-error — runtime guards
    assert.doesNotThrow(() => getMarketTargetPricing({}))
    // @ts-expect-error
    assert.doesNotThrow(() => getMarketTargetPricing({ variety: 42 }))
    assert.doesNotThrow(() => getMarketTargetPricing({
      variety: "Geisha", scaScore: -100, altitude: -1, country: "",
    }))
  })

  it("low ≤ expected ≤ high across every cell of every table", () => {
    const samples: Array<{
      label: string
      input: Parameters<typeof getMarketTargetPricing>[0]
    }> = [
      // Normal coverage
      { label: "Castillo 80",  input: { variety: "Castillo", scaScore: 80 } },
      { label: "Castillo 85",  input: { variety: "Castillo", scaScore: 85 } },
      { label: "Castillo 88",  input: { variety: "Castillo", scaScore: 88 } },
      { label: "Castillo 90",  input: { variety: "Castillo", scaScore: 90 } },
      { label: "Castillo 92",  input: { variety: "Castillo", scaScore: 92 } },
      { label: "Bourbon 91",   input: { variety: "Bourbon", scaScore: 91 } },
      { label: "Tabi 84",      input: { variety: "Tabi", scaScore: 84 } },
      // Pink Bourbon
      { label: "PB Col 1700/87",  input: { variety: "Pink Bourbon", country: "Colombia", altitude: 1700, scaScore: 87 } },
      { label: "PB Col 2000/91",  input: { variety: "Pink Bourbon", country: "Colombia", altitude: 2000, scaScore: 91 } },
      { label: "PB Panama/90",    input: { variety: "Pink Bourbon", country: "Panama", scaScore: 90 } },
      { label: "PB CR/89",        input: { variety: "Pink Bourbon", country: "Costa Rica", scaScore: 89 } },
      // Geisha
      { label: "Geisha Col 1800/87",       input: { variety: "Geisha", country: "Colombia", altitude: 1800, scaScore: 87 } },
      { label: "Geisha Col 2050/91",       input: { variety: "Geisha", country: "Colombia", altitude: 2050, scaScore: 91 } },
      { label: "Geisha Panama non-famous", input: { variety: "Geisha", country: "Panama", scaScore: 90 } },
      { label: "Geisha Panama famous",     input: { variety: "Geisha", country: "Panama", scaScore: 90, producerPrestigeTier: "FAMOUS_ESTATE" } },
      { label: "Geisha Ethiopia/93",       input: { variety: "Geisha", country: "Ethiopia", scaScore: 93 } },
      { label: "Geisha Bolivia/89",        input: { variety: "Geisha", country: "Bolivia", scaScore: 89 } },
    ]

    for (const { label, input } of samples) {
      const r = getMarketTargetPricing(input)
      assert.ok(r.ok, `${label}: expected ok=true`)
      assert.ok(
        r.band.low <= r.band.expected && r.band.expected <= r.band.high,
        `${label}: invariant low ≤ expected ≤ high failed (${r.band.low} / ${r.band.expected} / ${r.band.high})`
      )
    }
  })

  it("unsupported variety → ok:false with UNSUPPORTED_VARIETY", () => {
    const r = getMarketTargetPricing({ variety: "Pacamara", scaScore: 88 })
    assert.equal(r.ok, false)
    if (!r.ok) assert.ok(r.reasons.includes("UNSUPPORTED_VARIETY"))
  })

  it("source is RESEARCH_2026_05_TABLE for every successful call", () => {
    const r1 = getMarketTargetPricing({ variety: "Castillo", scaScore: 84 })
    const r2 = getMarketTargetPricing({ variety: "Pink Bourbon", country: "Colombia", altitude: 1700, scaScore: 89 })
    const r3 = getMarketTargetPricing({ variety: "Geisha", country: "Panama", scaScore: 90, producerPrestigeTier: "FAMOUS_ESTATE" })
    assert.ok(r1.ok && r2.ok && r3.ok)
    assert.equal(r1.source, "RESEARCH_2026_05_TABLE")
    assert.equal(r2.source, "RESEARCH_2026_05_TABLE")
    assert.equal(r3.source, "RESEARCH_2026_05_TABLE")
  })
})
